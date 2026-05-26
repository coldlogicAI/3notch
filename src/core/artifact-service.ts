import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { assertSafeRelativePath, normalizePortablePath } from './path-safety.js';
import { assertNoSecretsInArtifactWithAudit } from './secret-scan-service.js';
import { CURRENT_PACKET_SCHEMA_VERSION } from './record-factory.js';
import { NotchException, type NotchError } from '../types/errors.js';
import type { LoadedConfig } from './config-service.js';
import type { PacketBundleFile } from './store-service.js';
import type {
  Actor,
  ActorNameResolution,
  ActorTypeResolution,
  NotchConfig,
  NotchPacket,
  PacketArtifact,
  PacketArtifactPurpose,
  SourceTool,
} from '../types/records.js';

export const ARTIFACT_PURPOSES = ['asset', 'source', 'reference', 'output'] as const;
const ARTIFACT_PURPOSE_ALIASES: Record<string, PacketArtifactPurpose> = {
  code: 'source',
  favicon: 'asset',
  favicons: 'asset',
  icon: 'asset',
  icons: 'asset',
  image: 'asset',
  images: 'asset',
  img: 'asset',
  logo: 'asset',
  logos: 'asset',
  media: 'asset',
  photo: 'asset',
  photos: 'asset',
  picture: 'asset',
  pictures: 'asset',
  ref: 'reference',
  refs: 'reference',
  result: 'output',
  results: 'output',
  screenshot: 'asset',
  screenshots: 'asset',
  src: 'source',
};
export const DEFAULT_MAX_ARTIFACT_BYTES = 50 * 1024 * 1024;
export const DEFAULT_MAX_PACKET_BYTES = 200 * 1024 * 1024;
export const SIZE_WARN_RATIO = 0.8;

export type ArtifactFileInput = {
  path: string;
  purpose?: PacketArtifactPurpose;
};

export type PreparedPacketArtifact = {
  artifact: PacketArtifact;
  content: Buffer;
  sourcePath: string;
};

export type PreparedPacketArtifacts = {
  artifacts: PacketArtifact[];
  bundleFiles: PacketBundleFile[];
  prepared: PreparedPacketArtifact[];
  warnings: NotchError[];
};

export type PacketManifest = {
  schemaVersion: string;
  packetId: string;
  generatedAt: string;
  artifacts: Array<Pick<PacketArtifact, 'path' | 'sha256' | 'bytes'>>;
};

export function parseArtifactFileSpec(value: string): ArtifactFileInput {
  const delimiter = value.lastIndexOf(':');

  if (delimiter === -1) {
    return { path: value };
  }

  const maybePurpose = value.slice(delimiter + 1);
  const normalizedPurpose = maybePurpose.trim().toLowerCase();

  if (isArtifactPurpose(normalizedPurpose)) {
    return {
      path: value.slice(0, delimiter),
      purpose: normalizedPurpose,
    };
  }

  const aliasPurpose = ARTIFACT_PURPOSE_ALIASES[normalizedPurpose];

  if (aliasPurpose) {
    return {
      path: value.slice(0, delimiter),
      purpose: aliasPurpose,
    };
  }

  if (/[\\/]/.test(maybePurpose) || maybePurpose.includes('.')) {
    return { path: value };
  }

  throw new NotchException({
    code: 'NOTCH_ARTIFACT_PURPOSE_INVALID',
    message: `Invalid artifact purpose "${maybePurpose}" in file spec: ${value}`,
    path: value,
    recovery: `Use one of: ${ARTIFACT_PURPOSES.join(', ')}. Common labels like favicon, icon, logo, image, and screenshot are accepted as asset.`,
    severity: 'error',
    exitCode: 1,
  });
}

export async function preparePacketArtifacts(
  context: LoadedConfig,
  input: {
    actor: Actor;
    actorNameResolution: ActorNameResolution;
    actorTypeResolution: ActorTypeResolution;
    files: ArtifactFileInput[];
    packetId: string;
    sourceTool: SourceTool;
  },
): Promise<PreparedPacketArtifacts> {
  const limits = artifactLimits(context.config);
  const warnings: NotchError[] = [];
  const prepared: PreparedPacketArtifact[] = [];
  const usedArtifactPaths = new Set<string>();
  let totalBytes = 0;

  for (const file of input.files) {
    const safe = assertSafeRelativePath(file.path, context.config.project.root);
    assertNotStorePath(safe.relativePath);
    const fileStat = await lstat(safe.absolutePath);

    if (fileStat.isSymbolicLink()) {
      throw new NotchException({
        code: 'NOTCH_SYMLINK_REJECTED',
        message: `Packet artifacts do not follow symlinks: ${file.path}`,
        path: file.path,
        recovery: 'Copy the real file into the project and attach that file instead.',
        severity: 'error',
        exitCode: 5,
      });
    }

    if (!fileStat.isFile()) {
      throw new NotchException({
        code: 'NOTCH_ARTIFACT_INVALID',
        message: `Packet artifacts must be regular files: ${file.path}`,
        path: file.path,
        recovery: 'Attach a regular file or package a directory yourself before attaching it.',
        severity: 'error',
        exitCode: 1,
      });
    }

    if (fileStat.size >= limits.maxArtifactBytes) {
      throw tooLargeError('NOTCH_ARTIFACT_TOO_LARGE', file.path, fileStat.size, limits.maxArtifactBytes);
    }

    if (totalBytes + fileStat.size >= limits.maxPacketBytes) {
      throw tooLargeError('NOTCH_PACKET_TOO_LARGE', file.path, totalBytes + fileStat.size, limits.maxPacketBytes);
    }

    if (fileStat.size >= limits.maxArtifactBytes * SIZE_WARN_RATIO) {
      warnings.push(sizeWarning('NOTCH_ARTIFACT_SIZE_WARN', file.path, fileStat.size, limits.maxArtifactBytes));
    }

    if (totalBytes + fileStat.size >= limits.maxPacketBytes * SIZE_WARN_RATIO) {
      warnings.push(sizeWarning('NOTCH_PACKET_SIZE_WARN', file.path, totalBytes + fileStat.size, limits.maxPacketBytes));
    }

    const content = await readFile(safe.absolutePath);
    const artifactPath = uniqueArtifactPath(path.basename(safe.relativePath), usedArtifactPaths);

    await assertNoSecretsInArtifactWithAudit(content, context.config, {
      actor: input.actor,
      actorNameResolution: input.actorNameResolution,
      actorTypeResolution: input.actorTypeResolution,
      logsDir: context.paths.logs,
      path: artifactPath,
      recordId: input.packetId,
      recordType: 'packet',
      sourcePath: safe.relativePath,
      sourceTool: input.sourceTool,
    });

    const artifact: PacketArtifact = {
      path: artifactPath,
      sha256: sha256(content),
      bytes: fileStat.size,
      purpose: file.purpose ?? 'asset',
    };

    prepared.push({ artifact, content, sourcePath: safe.absolutePath });
    totalBytes += fileStat.size;
  }

  const sorted = [...prepared].sort((left, right) => left.artifact.path.localeCompare(right.artifact.path));
  const artifacts = sorted.map((entry) => entry.artifact);
  const bundleFiles = sorted.map((entry) => ({
    relativePath: entry.artifact.path,
    content: entry.content,
  }));

  return { artifacts, bundleFiles, prepared: sorted, warnings };
}

export function manifestForPacket(packet: NotchPacket): PacketManifest {
  return {
    schemaVersion: CURRENT_PACKET_SCHEMA_VERSION,
    packetId: packet.id,
    generatedAt: packet.createdAt,
    artifacts: [...(packet.artifacts ?? [])]
      .sort((left, right) => left.path.localeCompare(right.path))
      .map((artifact) => ({
        path: artifact.path,
        sha256: artifact.sha256,
        bytes: artifact.bytes,
      })),
  };
}

export function manifestBundleFile(packet: NotchPacket): PacketBundleFile | undefined {
  if ((packet.artifacts ?? []).length === 0) {
    return undefined;
  }

  return {
    relativePath: 'manifest.json',
    content: `${JSON.stringify(manifestForPacket(packet), null, 2)}\n`,
  };
}

export async function verifyPacketFolderArtifacts(packetRoot: string, packet: NotchPacket): Promise<void> {
  const rootStat = await stat(packetRoot).catch(() => undefined);
  const artifacts = packet.artifacts ?? [];

  if (!rootStat?.isDirectory()) {
    if (artifacts.length > 0) {
      throw artifactMismatch('Packet declares artifacts but is not a packet folder.', packetRoot);
    }
    return;
  }

  if (artifacts.length === 0) {
    return;
  }

  const manifest = await readPacketManifest(packetRoot);

  if (manifest.packetId !== packet.id) {
    throw artifactMismatch(`Manifest packetId ${manifest.packetId} does not match ${packet.id}.`, packetRoot);
  }

  const frontmatterArtifacts = [...artifacts].sort((left, right) => left.path.localeCompare(right.path));
  const manifestArtifacts = [...manifest.artifacts].sort((left, right) => left.path.localeCompare(right.path));

  if (frontmatterArtifacts.length !== manifestArtifacts.length) {
    throw artifactMismatch('Manifest artifact count does not match packet frontmatter.', packetRoot);
  }

  for (const [index, frontmatter] of frontmatterArtifacts.entries()) {
    const manifestEntry = manifestArtifacts[index];

    if (
      !manifestEntry
      || frontmatter.path !== manifestEntry.path
      || frontmatter.sha256 !== manifestEntry.sha256
      || frontmatter.bytes !== manifestEntry.bytes
    ) {
      throw artifactMismatch(`Manifest does not match frontmatter for ${frontmatter.path}.`, packetRoot);
    }

    assertSafeArtifactPath(frontmatter.path);
  }

  const actualPaths = await artifactFilePaths(packetRoot);
  const expectedPaths = manifestArtifacts.map((artifact) => artifact.path).sort();

  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    throw artifactMismatch('Artifact files do not match manifest paths.', packetRoot);
  }

  for (const artifact of manifestArtifacts) {
    const content = await readFile(path.join(packetRoot, artifact.path));

    if (content.byteLength !== artifact.bytes || sha256(content) !== artifact.sha256) {
      throw artifactMismatch(`Artifact hash mismatch: ${artifact.path}`, path.join(packetRoot, artifact.path));
    }
  }
}

export async function readPacketBundleFiles(packetRoot: string): Promise<PacketBundleFile[]> {
  const rootStat = await stat(packetRoot).catch(() => undefined);

  if (!rootStat?.isDirectory()) {
    return [];
  }

  const files: PacketBundleFile[] = [];

  for (const relativePath of await packetBundleRelativePaths(packetRoot)) {
    if (relativePath === 'packet.md') {
      continue;
    }

    files.push({
      relativePath,
      content: await readFile(path.join(packetRoot, relativePath)),
    });
  }

  return files;
}

export function assertSafeArtifactPath(relativePath: string): void {
  const normalized = normalizePortablePath(relativePath);
  const parts = normalized.split('/');

  if (
    !normalized.startsWith('artifacts/')
    || normalized.includes('\\')
    || parts.some((part) => part.length === 0 || part === '.' || part === '..' || part.startsWith('.'))
  ) {
    throw new NotchException({
      code: 'NOTCH_ARTIFACT_PATH_INVALID',
      message: `Artifact path is unsafe: ${relativePath}`,
      path: relativePath,
      recovery: 'Artifact paths must be relative paths under artifacts/ without dot-prefixed components.',
      severity: 'error',
      exitCode: 1,
    });
  }
}

export function sha256(content: Buffer | string): string {
  return createHash('sha256').update(content).digest('hex');
}

function artifactLimits(config: NotchConfig): { maxArtifactBytes: number; maxPacketBytes: number } {
  return {
    maxArtifactBytes: config.artifacts?.maxArtifactBytes ?? DEFAULT_MAX_ARTIFACT_BYTES,
    maxPacketBytes: config.artifacts?.maxPacketBytes ?? DEFAULT_MAX_PACKET_BYTES,
  };
}

function uniqueArtifactPath(basename: string, used: Set<string>): string {
  const normalizedBase = normalizePortablePath(basename);

  if (
    normalizedBase.length === 0
    || normalizedBase.includes('/')
    || normalizedBase.startsWith('.')
    || normalizedBase === '.'
    || normalizedBase === '..'
  ) {
    throw new NotchException({
      code: 'NOTCH_ARTIFACT_PATH_INVALID',
      message: `Artifact filename is unsafe: ${basename}`,
      path: basename,
      recovery: 'Use a regular filename that does not start with a dot.',
      severity: 'error',
      exitCode: 1,
    });
  }

  const parsed = path.posix.parse(normalizedBase);
  let candidate = `artifacts/${normalizedBase}`;
  let suffix = 2;

  while (used.has(candidate)) {
    candidate = `artifacts/${parsed.name}-${suffix}${parsed.ext}`;
    suffix += 1;
  }

  assertSafeArtifactPath(candidate);
  used.add(candidate);
  return candidate;
}

function isArtifactPurpose(value: string): value is PacketArtifactPurpose {
  return ARTIFACT_PURPOSES.includes(value as PacketArtifactPurpose);
}

function assertNotStorePath(relativePath: string): void {
  if (relativePath === '.notch' || relativePath.startsWith('.notch/')) {
    throw new NotchException({
      code: 'NOTCH_ARTIFACT_PATH_INVALID',
      message: 'Packet artifacts cannot be read from the .notch store.',
      path: relativePath,
      recovery: 'Attach source files from the project tree, not 3Notch store internals.',
      severity: 'error',
      exitCode: 5,
    });
  }
}

async function readPacketManifest(packetRoot: string): Promise<PacketManifest> {
  const manifestPath = path.join(packetRoot, 'manifest.json');
  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch {
    throw artifactMismatch('Packet artifacts require a readable manifest.json.', manifestPath);
  }

  if (!isPacketManifest(parsed)) {
    throw artifactMismatch('Packet manifest.json is invalid.', manifestPath);
  }

  return parsed;
}

function isPacketManifest(value: unknown): value is PacketManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<PacketManifest>;
  return (
    typeof candidate.schemaVersion === 'string'
    && typeof candidate.packetId === 'string'
    && typeof candidate.generatedAt === 'string'
    && Array.isArray(candidate.artifacts)
    && candidate.artifacts.every((artifact) => (
      typeof artifact === 'object'
      && artifact !== null
      && typeof artifact.path === 'string'
      && typeof artifact.sha256 === 'string'
      && typeof artifact.bytes === 'number'
    ))
  );
}

async function artifactFilePaths(packetRoot: string): Promise<string[]> {
  const artifactsRoot = path.join(packetRoot, 'artifacts');
  const rootStat = await stat(artifactsRoot).catch(() => undefined);

  if (!rootStat?.isDirectory()) {
    return [];
  }

  return (await walkFiles(artifactsRoot))
    .map((filePath) => path.relative(packetRoot, filePath).split(path.sep).join('/'))
    .sort();
}

async function packetBundleRelativePaths(packetRoot: string): Promise<string[]> {
  return (await walkFiles(packetRoot))
    .map((filePath) => path.relative(packetRoot, filePath).split(path.sep).join('/'))
    .filter((relativePath) => relativePath === 'packet.md' || relativePath === 'manifest.json' || relativePath.startsWith('artifacts/'))
    .sort();
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const filePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return await walkFiles(filePath);
    }

    return entry.isFile() ? [filePath] : [];
  }));

  return files.flat();
}

function artifactMismatch(message: string, filePath: string): NotchException {
  return new NotchException({
    code: 'NOTCH_ARTIFACT_HASH_MISMATCH',
    message,
    path: filePath,
    recovery: 'Recreate the packet from the sender; artifact bytes no longer match the packet manifest.',
    severity: 'error',
    exitCode: 6,
  });
}

function tooLargeError(code: 'NOTCH_ARTIFACT_TOO_LARGE' | 'NOTCH_PACKET_TOO_LARGE', filePath: string, bytes: number, limit: number): NotchException {
  return new NotchException({
    code,
    message: `${filePath} is ${bytes} bytes, which meets or exceeds the ${limit} byte V3 artifact limit.`,
    path: filePath,
    recovery: 'Attach a smaller artifact, split the packet, or raise the configured artifact limits intentionally.',
    severity: 'error',
    exitCode: 1,
  });
}

function sizeWarning(code: string, filePath: string, bytes: number, limit: number): NotchError {
  return {
    code,
    message: `${filePath} is ${bytes} bytes, at least ${Math.round(SIZE_WARN_RATIO * 100)}% of the ${limit} byte artifact limit.`,
    path: filePath,
    recovery: 'Consider splitting large artifact bundles before moving them between tools.',
    severity: 'warn',
  };
}
