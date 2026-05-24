import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { readAuditLog } from '../../src/core/audit-service.js';
import { createPacket } from '../../src/core/packet-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import { importPacketFile } from '../../src/core/transfer-service.js';
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
});
