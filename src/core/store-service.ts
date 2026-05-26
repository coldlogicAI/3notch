import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

import { parseAndValidateRecord, parseRecordMarkdown, type ParsedRecord, type RecordParserResult } from './record-parser.js';
import { packetFolderPath, packetMarkdownPath, sourceRecordDirs, toStoreRelativePath } from './store-layout.js';
import { NotchException } from '../types/errors.js';

export type WriteRecordOptions = {
  content: string;
  directory: string;
  explicitSlug?: boolean;
  extension?: string;
  slug: string;
};

export type WrittenRecord = {
  path: string;
  relativePath: string;
  rootPath?: string;
  rootRelativePath?: string;
};

export type PacketBundleFile = {
  content: Buffer | string;
  relativePath: string;
};

export type WritePacketBundleOptions = {
  directory: string;
  explicitSlug?: boolean;
  files: PacketBundleFile[];
  packetMarkdown: string;
  slug: string;
};

export type ScannedRecord = RecordParserResult & {
  path: string;
  relativePath: string;
};

export type ValidScannedRecord = Extract<ScannedRecord, { ok: true }>;

export function isValidScannedRecord(record: ScannedRecord): record is ValidScannedRecord {
  return record.ok;
}

export async function ensureDir(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
}

export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.tmp`);
  await writeFile(tempPath, content, 'utf8');
  await rename(tempPath, filePath);
}

export async function writeRecordWithCollisionHandling(
  storePath: string,
  options: WriteRecordOptions,
): Promise<WrittenRecord> {
  const extension = options.extension ?? '.md';
  const filename = await uniqueFilename(options.directory, options.slug, extension, options.explicitSlug ?? false);
  const filePath = path.join(options.directory, filename);

  await atomicWriteFile(filePath, options.content);

  return {
    path: filePath,
    relativePath: toStoreRelativePath(storePath, filePath),
  };
}

export async function writePacketBundleWithCollisionHandling(
  storePath: string,
  options: WritePacketBundleOptions,
): Promise<WrittenRecord> {
  const folderName = await uniquePacketFolderName(options.directory, options.slug, options.explicitSlug ?? false);
  const folderPath = packetFolderPath(options.directory, folderName);
  await assertImmutablePacketFolder(folderPath);
  const tempFolderPath = path.join(options.directory, `.${folderName}.${process.pid}.${Date.now()}.tmp`);
  const markdownPath = packetMarkdownPath(tempFolderPath);

  try {
    await atomicWriteFile(markdownPath, options.packetMarkdown);

    for (const file of options.files) {
      assertSafeBundleRelativePath(file.relativePath);
      const filePath = path.join(tempFolderPath, file.relativePath);
      await ensureDir(path.dirname(filePath));
      await writeFile(filePath, file.content);
    }

    await rename(tempFolderPath, folderPath);
  } catch (error) {
    await rm(tempFolderPath, { force: true, recursive: true });
    throw error;
  }

  const finalMarkdownPath = packetMarkdownPath(folderPath);

  return {
    path: finalMarkdownPath,
    relativePath: toStoreRelativePath(storePath, finalMarkdownPath),
    rootPath: folderPath,
    rootRelativePath: toStoreRelativePath(storePath, folderPath),
  };
}

export async function assertImmutablePacketFolder(folderPath: string): Promise<void> {
  const folderStat = await stat(folderPath).catch(() => undefined);

  if (!folderStat?.isDirectory()) {
    return;
  }

  const sealedFiles = ['packet.md', 'manifest.json'];

  for (const name of sealedFiles) {
    const fileStat = await stat(path.join(folderPath, name)).catch(() => undefined);

    if (fileStat?.isFile()) {
      throw immutableFolderError(path.join(folderPath, name));
    }
  }

  const artifactsPath = path.join(folderPath, 'artifacts');
  const artifactsStat = await stat(artifactsPath).catch(() => undefined);

  if (artifactsStat?.isDirectory()) {
    const entries = await readdir(artifactsPath, { withFileTypes: true }).catch(() => []);
    const firstFile = entries.find((entry) => entry.isFile());

    if (firstFile) {
      throw immutableFolderError(path.join(artifactsPath, firstFile.name));
    }
  }
}

function immutableFolderError(filePath: string): NotchException {
  return new NotchException({
    code: 'NOTCH_RECORD_IMMUTABLE',
    message: `Refusing to overwrite sealed packet bundle file: ${filePath}`,
    path: filePath,
    recovery: 'Imported packet bundles are immutable. Author a successor packet with supersedes instead of overwriting.',
    severity: 'error',
    exitCode: 6,
  });
}

export async function scanMarkdownRecords(
  storePath: string,
  options: { includeInvalid?: boolean; includePrivate?: boolean } = {},
): Promise<ScannedRecord[]> {
  const dirs = sourceRecordDirs.filter((dir) => options.includePrivate || !dir.startsWith('private/'));
  const files: string[] = [];

  for (const dir of dirs) {
    const absoluteDir = path.join(storePath, dir);

    if (!(await exists(absoluteDir))) {
      continue;
    }

    files.push(...(await markdownFiles(absoluteDir)));
  }

  const briefPath = path.join(storePath, 'brief.md');

  if (await exists(briefPath)) {
    files.push(briefPath);
  }

  const results = await Promise.all(
    files.map(async (filePath) => {
      const markdown = await readFile(filePath, 'utf8');
      const parsed = options.includeInvalid
        ? parseRecordMarkdown(markdown, filePath)
        : parseAndValidateRecord(markdown, filePath);

      return normalizeScannedRecord(parsed, filePath, toStoreRelativePath(storePath, filePath));
    }),
  );

  return options.includeInvalid ? results : results.filter((result) => result.ok);
}

function normalizeScannedRecord(
  parsed: ReturnType<typeof parseRecordMarkdown> | ReturnType<typeof parseAndValidateRecord>,
  filePath: string,
  relativePath: string,
): ScannedRecord {
  if (!parsed.ok) {
    return { ...parsed, path: filePath, relativePath };
  }

  if ('record' in parsed) {
    return { ...parsed, path: filePath, relativePath };
  }

  const record: ParsedRecord = {
    body: parsed.body ?? '',
    metadata: parsed.data as Record<string, unknown>,
    path: filePath,
  };

  return {
    ok: true,
    path: filePath,
    record,
    relativePath,
    warnings: parsed.warnings,
  };
}

export function renderMarkdownRecord(frontmatter: Record<string, unknown>, body: string): string {
  return `---\n${YAML.stringify(frontmatter).trimEnd()}\n---\n\n${body.trimStart()}`;
}

async function uniqueFilename(
  directory: string,
  slug: string,
  extension: string,
  explicitSlug: boolean,
): Promise<string> {
  const base = slug.endsWith(extension) ? slug.slice(0, -extension.length) : slug;
  let candidate = `${base}${extension}`;
  let suffix = 2;

  while (
    await exists(path.join(directory, candidate))
    || await exists(path.join(directory, candidate.slice(0, -extension.length)))
  ) {
    if (explicitSlug) {
      throw new NotchException({
        code: 'NOTCH_WRITE_FAILED',
        message: `Record already exists for explicit slug: ${slug}`,
        path: path.join(directory, candidate),
        recovery: 'Choose another slug or omit the slug to allow automatic suffixing.',
        severity: 'error',
        exitCode: 1,
      });
    }

    candidate = `${base}-${suffix}${extension}`;
    suffix += 1;
  }

  return candidate;
}

async function uniquePacketFolderName(
  directory: string,
  slug: string,
  explicitSlug: boolean,
): Promise<string> {
  const base = slug.replace(/\.md$/, '');
  let candidate = base;
  let suffix = 2;

  while (await exists(path.join(directory, candidate)) || await exists(path.join(directory, `${candidate}.md`))) {
    if (explicitSlug) {
      throw new NotchException({
        code: 'NOTCH_WRITE_FAILED',
        message: `Packet folder already exists for explicit slug: ${slug}`,
        path: path.join(directory, candidate),
        recovery: 'Choose another slug or omit the slug to allow automatic suffixing.',
        severity: 'error',
        exitCode: 1,
      });
    }

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'artifacts') {
          return [];
        }

        return await markdownFiles(filePath);
      }

      return entry.isFile() && entry.name.endsWith('.md') ? [filePath] : [];
    }),
  );

  return files.flat();
}

function assertSafeBundleRelativePath(relativePath: string): void {
  const normalized = relativePath.split(path.sep).join('/');

  if (
    normalized.length === 0
    || normalized.startsWith('/')
    || normalized.includes('\\')
    || normalized.split('/').some((part) => part.length === 0 || part === '.' || part === '..')
  ) {
    throw new NotchException({
      code: 'NOTCH_PATH_OUTSIDE_STORE',
      message: `Packet bundle path is unsafe: ${relativePath}`,
      path: relativePath,
      recovery: 'Use a relative path inside the packet folder.',
      severity: 'error',
      exitCode: 5,
    });
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
