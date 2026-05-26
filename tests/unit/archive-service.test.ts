import { gzipSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createPacketArchive, readArchiveEntries, unpackPacketArchiveToTemp } from '../../src/core/archive-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import { createPacket } from '../../src/core/packet-service.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('archive service', () => {
  it('creates deterministic .notchpkt archives and unpacks only safe files', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'archive-app' });
      await mkdir(path.join(project.path, 'assets'), { recursive: true });
      await writeFile(path.join(project.path, 'assets/showcase.html'), '<main>3Notch</main>\n', 'utf8');
      const context = await loadConfig({ cwd: project.path });
      const created = await createPacket(context, {
        files: [{ path: 'assets/showcase.html', purpose: 'source' }],
        summary: 'Archive packet.',
        title: 'Archive packet',
        toAgent: 'codex',
      });
      const archiveInput = { markdownPath: created.outboxPath, rootPath: path.dirname(created.outboxPath) };
      const first = await createPacketArchive(archiveInput);
      const second = await createPacketArchive(archiveInput);

      expect(first.equals(second)).toBe(true);
      expect(readArchiveEntries(first).map((entry) => entry.path)).toEqual([
        'artifacts/assets/showcase.html',
        'manifest.json',
        'packet.md',
      ]);

      const unpacked = await unpackPacketArchiveToTemp(first);
      try {
        expect(await readFile(path.join(unpacked.packetFolderPath, 'artifacts/assets/showcase.html'), 'utf8')).toBe('<main>3Notch</main>\n');
      } finally {
        await unpacked.cleanup();
      }
    });
  });

  it('packs and unpacks a V2 single-file packet without artifacts', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'v2-archive-app' });
      const context = await loadConfig({ cwd: project.path });
      const created = await createPacket(context, {
        summary: 'Single-file packet.',
        title: 'Single-file packet',
        toAgent: 'codex',
      });

      expect(created.outboxPath.endsWith('.md')).toBe(true);

      const archive = await createPacketArchive({
        markdownPath: created.outboxPath,
        rootPath: created.outboxPath,
      });

      expect(readArchiveEntries(archive).map((entry) => entry.path)).toEqual(['packet.md']);

      const unpacked = await unpackPacketArchiveToTemp(archive);
      try {
        expect(await readFile(path.join(unpacked.packetFolderPath, 'packet.md'), 'utf8')).toBe(
          await readFile(created.outboxPath, 'utf8'),
        );
      } finally {
        await unpacked.cleanup();
      }
    });
  });

  it('rejects archives with path traversal, absolute paths, and unexpected top-level entries', async () => {
    const traversalArchive = buildHostileArchive([
      { name: 'packet.md', content: Buffer.from('---\n---\nbody\n') },
      { name: 'artifacts/../../escape.txt', content: Buffer.from('escape') },
    ]);
    const absoluteArchive = buildHostileArchive([
      { name: 'packet.md', content: Buffer.from('---\n---\nbody\n') },
      { name: '/etc/passwd', content: Buffer.from('root:x:0:0') },
    ]);
    const unexpectedArchive = buildHostileArchive([
      { name: 'packet.md', content: Buffer.from('---\n---\nbody\n') },
      { name: 'README.md', content: Buffer.from('not in the bundle layout') },
    ]);

    expect(() => readArchiveEntries(traversalArchive)).toThrowError(expect.objectContaining({
      notchError: expect.objectContaining({ code: 'NOTCH_ARCHIVE_UNSAFE' }),
    }));
    expect(() => readArchiveEntries(absoluteArchive)).toThrowError(expect.objectContaining({
      notchError: expect.objectContaining({ code: 'NOTCH_ARCHIVE_UNSAFE' }),
    }));
    expect(() => readArchiveEntries(unexpectedArchive)).toThrowError(expect.objectContaining({
      notchError: expect.objectContaining({ code: 'NOTCH_ARCHIVE_UNSAFE' }),
    }));
    await expect(unpackPacketArchiveToTemp(traversalArchive)).rejects.toMatchObject({
      notchError: { code: 'NOTCH_ARCHIVE_UNSAFE' },
    });
  });
});

function buildHostileArchive(entries: Array<{ name: string; content: Buffer }>): Buffer {
  const tarParts: Buffer[] = [];

  for (const entry of entries) {
    tarParts.push(buildTarHeader(entry.name, entry.content.byteLength), entry.content);
    const remainder = entry.content.byteLength % 512;

    if (remainder !== 0) {
      tarParts.push(Buffer.alloc(512 - remainder));
    }
  }

  tarParts.push(Buffer.alloc(512), Buffer.alloc(512));
  return gzipSync(Buffer.concat(tarParts));
}

function buildTarHeader(name: string, size: number): Buffer {
  const header = Buffer.alloc(512, 0);
  header.write(name.slice(0, 100), 0, 100, 'utf8');
  header.write(`${'0644'.padStart(7, '0')}\0`, 100, 8, 'ascii');
  header.write(`${'0'.padStart(7, '0')}\0`, 108, 8, 'ascii');
  header.write(`${'0'.padStart(7, '0')}\0`, 116, 8, 'ascii');
  header.write(`${size.toString(8).padStart(11, '0')}\0`, 124, 12, 'ascii');
  header.write(`${'0'.padStart(11, '0')}\0`, 136, 12, 'ascii');
  header.fill(0x20, 148, 156);
  header.write('0', 156, 1, 'ascii');
  header.write('ustar', 257, 6, 'utf8');
  header.write('00', 263, 2, 'utf8');

  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(`${checksum.toString(8).padStart(7, '0')}\0`, 148, 8, 'ascii');
  return header;
}
