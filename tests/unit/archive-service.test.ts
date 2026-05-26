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
        'artifacts/showcase.html',
        'manifest.json',
        'packet.md',
      ]);

      const unpacked = await unpackPacketArchiveToTemp(first);
      try {
        expect(await readFile(path.join(unpacked.packetFolderPath, 'artifacts/showcase.html'), 'utf8')).toBe('<main>3Notch</main>\n');
      } finally {
        await unpacked.cleanup();
      }
    });
  });
});
