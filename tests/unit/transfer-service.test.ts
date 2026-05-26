import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { readAuditLog } from '../../src/core/audit-service.js';
import { createPacket } from '../../src/core/packet-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import { assertImmutableRecordDestination, importPacketFile } from '../../src/core/transfer-service.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('transfer service', () => {
  it('imports repo A outbox packets into repo B inbox without merging source records', async () => {
    await withTempProject({ prefix: 'notch-source-' }, async (source) => {
      await withTempProject({ prefix: 'notch-dest-' }, async (destination) => {
        await createBareStore(source.path, { name: 'source-app' });
        await createBareStore(destination.path, { name: 'destination-app' });
        const sourceContext = await loadConfig({ cwd: source.path });
        const destinationContext = await loadConfig({ cwd: destination.path });
        const created = await createPacket(sourceContext, {
          sourceLinks: [{ kind: 'file', path: 'src/index.ts' }],
          summary: 'State from source app.',
          title: 'Source app state',
          toAgent: 'codex',
          toRepo: destination.path,
        });

        const imported = await importPacketFile(destinationContext, created.outboxPath, { asReviewed: true });
        const importedMarkdown = await readFile(imported.inboxPath, 'utf8');

        expect(imported.inboxPath).toContain('.notch/inbox');
        expect(importedMarkdown).toContain(`importedFrom: ${path.basename(created.outboxPath)}`);
        expect(importedMarkdown).not.toContain(`importedFrom: ${created.outboxPath}`);
        expect(await readAuditLog(destinationContext.paths.logs)).toEqual([
          expect.objectContaining({ importedFrom: created.outboxPath }),
        ]);
      });
    });
  });

  it('fails loudly before overwriting an immutable inbox packet with different content', async () => {
    await withTempProject({}, async (project) => {
      const packetPath = path.join(project.path, 'received.md');
      await writeFile(packetPath, 'existing packet content', 'utf8');

      await expect(assertImmutableRecordDestination(packetPath, 'different packet content')).rejects.toMatchObject({
        notchError: { code: 'NOTCH_RECORD_IMMUTABLE' },
      });
      await expect(assertImmutableRecordDestination(packetPath, 'existing packet content')).resolves.toBeUndefined();
    });
  });

  it('rejects packet folders with tampered artifacts before writing inbox state', async () => {
    await withTempProject({ prefix: 'notch-source-' }, async (source) => {
      await withTempProject({ prefix: 'notch-dest-' }, async (destination) => {
        await createBareStore(source.path, { name: 'source-app' });
        await createBareStore(destination.path, { name: 'destination-app' });
        await mkdir(path.join(source.path, 'assets'), { recursive: true });
        await writeFile(path.join(source.path, 'assets/context.txt'), 'Clean context.\n', 'utf8');
        const sourceContext = await loadConfig({ cwd: source.path });
        const destinationContext = await loadConfig({ cwd: destination.path });
        const created = await createPacket(sourceContext, {
          files: [{ path: 'assets/context.txt', purpose: 'source' }],
          summary: 'Source app state.',
          title: 'Source app state',
          toAgent: 'codex',
          toRepo: destination.path,
        });
        const packetRoot = path.dirname(created.outboxPath);
        await writeFile(path.join(packetRoot, 'artifacts/assets/context.txt'), 'Tampered context.\n', 'utf8');

        await expect(importPacketFile(destinationContext, packetRoot)).rejects.toMatchObject({
          notchError: { code: 'NOTCH_ARTIFACT_HASH_MISMATCH' },
        });
        expect(await readdir(destinationContext.paths.inbox)).toEqual([]);
        expect(await readAuditLog(destinationContext.paths.logs)).toEqual(expect.arrayContaining([
          expect.objectContaining({ errorCode: 'NOTCH_ARTIFACT_HASH_MISMATCH', operation: 'import', result: 'failed' }),
        ]));
      });
    });
  });
});
