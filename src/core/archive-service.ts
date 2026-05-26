import { gunzipSync, gzipSync } from 'node:zlib';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { assertSafeArtifactPath } from './artifact-service.js';
import { NotchException } from '../types/errors.js';

export type ArchiveEntry = {
  path: string;
  content: Buffer;
};

const blockSize = 512;
const zeroBlock = Buffer.alloc(blockSize);

export async function createPacketArchive(input: { markdownPath: string; rootPath: string }): Promise<Buffer> {
  const entries = await packetArchiveEntries(input);
  const tar = Buffer.concat([
    ...entries.flatMap((entry) => [tarHeader(entry.path, entry.content.byteLength), entry.content, padding(entry.content.byteLength)]),
    zeroBlock,
    zeroBlock,
  ]);

  return gzipSync(tar, { level: 9, mtime: 0 } as unknown as Parameters<typeof gzipSync>[1]);
}

export async function unpackPacketArchiveToTemp(archive: Buffer): Promise<{ cleanup: () => Promise<void>; packetFolderPath: string }> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'notch-unpack-'));
  const packetFolderPath = path.join(tempRoot, 'packet');

  try {
    await mkdir(packetFolderPath, { recursive: true });

    for (const entry of readArchiveEntries(archive)) {
      assertSafeArchiveEntryPath(entry.path);
      const outputPath = path.join(packetFolderPath, entry.path);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, entry.content);
    }

    await readFile(path.join(packetFolderPath, 'packet.md'));
    return {
      cleanup: async () => {
        await rm(tempRoot, { force: true, recursive: true });
      },
      packetFolderPath,
    };
  } catch (error) {
    await rm(tempRoot, { force: true, recursive: true });
    throw error;
  }
}

export function readArchiveEntries(archive: Buffer): ArchiveEntry[] {
  let tar: Buffer;

  try {
    tar = gunzipSync(archive);
  } catch {
    throw unsafeArchive('Archive is not a readable gzipped tar stream.');
  }

  const entries: ArchiveEntry[] = [];
  let offset = 0;

  while (offset + blockSize <= tar.length) {
    const header = tar.subarray(offset, offset + blockSize);
    offset += blockSize;

    if (header.every((byte) => byte === 0)) {
      break;
    }

    const typeflag = header.toString('utf8', 156, 157);

    if (typeflag !== '0' && typeflag !== '\0') {
      throw unsafeArchive('Archive entries must be regular files.');
    }

    const size = parseOctal(header.toString('utf8', 124, 136));
    const name = headerString(header, 0, 100);
    const prefix = headerString(header, 345, 155);
    const entryPath = prefix ? `${prefix}/${name}` : name;
    assertSafeArchiveEntryPath(entryPath);

    if (offset + size > tar.length) {
      throw unsafeArchive('Archive entry is truncated.');
    }

    entries.push({
      path: entryPath,
      content: Buffer.from(tar.subarray(offset, offset + size)),
    });
    offset += size + paddingLength(size);
  }

  if (!entries.some((entry) => entry.path === 'packet.md')) {
    throw unsafeArchive('Archive is missing packet.md.');
  }

  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function packetArchiveEntries(input: { markdownPath: string; rootPath: string }): Promise<ArchiveEntry[]> {
  const rootStat = await stat(input.rootPath);

  if (!rootStat.isDirectory()) {
    return [{ path: 'packet.md', content: await readFile(input.markdownPath) }];
  }

  const files = await walkFiles(input.rootPath);
  const entries = await Promise.all(files.map(async (filePath) => {
    const relativePath = path.relative(input.rootPath, filePath).split(path.sep).join('/');
    assertSafeArchiveEntryPath(relativePath);

    return {
      path: relativePath,
      content: await readFile(filePath),
    };
  }));

  return entries.sort((left, right) => left.path.localeCompare(right.path));
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

function tarHeader(entryPath: string, size: number): Buffer {
  const header = Buffer.alloc(blockSize, 0);
  const split = splitTarPath(entryPath);

  writeHeaderString(header, split.name, 0, 100);
  writeOctal(header, 0o644, 100, 8);
  writeOctal(header, 0, 108, 8);
  writeOctal(header, 0, 116, 8);
  writeOctal(header, size, 124, 12);
  writeOctal(header, 0, 136, 12);
  header.fill(0x20, 148, 156);
  writeHeaderString(header, '0', 156, 1);
  writeHeaderString(header, 'ustar', 257, 6);
  writeHeaderString(header, '00', 263, 2);

  if (split.prefix) {
    writeHeaderString(header, split.prefix, 345, 155);
  }

  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeOctal(header, checksum, 148, 8);

  return header;
}

function splitTarPath(entryPath: string): { name: string; prefix?: string } {
  if (Buffer.byteLength(entryPath) <= 100) {
    return { name: entryPath };
  }

  const slashIndex = entryPath.lastIndexOf('/');

  if (slashIndex === -1) {
    throw unsafeArchive(`Archive path is too long for ustar: ${entryPath}`);
  }

  const prefix = entryPath.slice(0, slashIndex);
  const name = entryPath.slice(slashIndex + 1);

  if (Buffer.byteLength(prefix) > 155 || Buffer.byteLength(name) > 100) {
    throw unsafeArchive(`Archive path is too long for ustar: ${entryPath}`);
  }

  return { name, prefix };
}

function writeHeaderString(header: Buffer, value: string, offset: number, length: number): void {
  if (Buffer.byteLength(value) > length) {
    throw unsafeArchive(`Archive header value is too long: ${value}`);
  }

  header.write(value, offset, length, 'utf8');
}

function writeOctal(header: Buffer, value: number, offset: number, length: number): void {
  const octal = value.toString(8).padStart(length - 1, '0');
  header.write(`${octal}\0`, offset, length, 'ascii');
}

function parseOctal(value: string): number {
  const trimmed = value.replace(/\0.*$/, '').trim();
  return trimmed.length === 0 ? 0 : Number.parseInt(trimmed, 8);
}

function headerString(header: Buffer, start: number, length: number): string {
  return header.toString('utf8', start, start + length).replace(/\0.*$/, '');
}

function padding(size: number): Buffer {
  return Buffer.alloc(paddingLength(size));
}

function paddingLength(size: number): number {
  return (blockSize - (size % blockSize)) % blockSize;
}

function assertSafeArchiveEntryPath(entryPath: string): void {
  const normalized = entryPath.split(path.sep).join('/');
  const parts = normalized.split('/');

  if (
    normalized.length === 0
    || normalized.startsWith('/')
    || normalized.includes('\\')
    || parts.some((part) => part.length === 0 || part === '.' || part === '..')
  ) {
    throw unsafeArchive(`Archive path is unsafe: ${entryPath}`);
  }

  if (normalized === 'packet.md' || normalized === 'manifest.json') {
    return;
  }

  if (normalized.startsWith('artifacts/')) {
    assertSafeArtifactPath(normalized);
    return;
  }

  throw unsafeArchive(`Archive contains an unexpected entry: ${entryPath}`);
}

function unsafeArchive(message: string): NotchException {
  return new NotchException({
    code: 'NOTCH_ARCHIVE_UNSAFE',
    message,
    recovery: 'Use a .notchpkt created by notch packet pack.',
    severity: 'error',
    exitCode: 6,
  });
}
