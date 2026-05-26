import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { appendAuditEntry, readAuditLog } from '../../src/core/audit-service.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('audit service', () => {
  it('appends valid JSONL audit entries', async () => {
    await withTempProject({}, async (project) => {
      const storePath = await createBareStore(project.path);
      const logsDir = path.join(storePath, 'logs');

      await appendAuditEntry(logsDir, {
        schemaVersion: '1.0.0',
        at: '2026-05-23T18:00:00Z',
        operation: 'create',
        result: 'success',
        actor: { actorType: 'human', name: 'Test User' },
        actorNameResolution: 'cli-flag',
        actorTypeResolution: 'cli-default',
        sourceTool: { name: 'notch-cli' },
        recordType: 'packet',
        recordId: 'packet_1',
        recordPath: '.notch/outbox/packet.md',
      });

      const entries = await readAuditLog(logsDir);
      expect(entries).toEqual([
        expect.objectContaining({ operation: 'create', recordId: 'packet_1' }),
      ]);
    });
  });

  it('accepts scan-skip artifact audit entries', async () => {
    await withTempProject({}, async (project) => {
      const storePath = await createBareStore(project.path);
      const logsDir = path.join(storePath, 'logs');

      await appendAuditEntry(logsDir, {
        schemaVersion: '1.0.0',
        at: '2026-05-23T18:00:00Z',
        operation: 'scan-skip',
        result: 'success',
        actor: { actorType: 'human', name: 'Test User' },
        actorNameResolution: 'cli-flag',
        actorTypeResolution: 'cli-default',
        sourceTool: { name: 'notch-cli' },
        recordType: 'packet',
        recordId: 'packet_1',
        path: 'artifacts/mascot.jpg',
        reason: 'extension-not-in-allowlist',
      });

      const entries = await readAuditLog(logsDir);
      expect(entries).toEqual([
        expect.objectContaining({ operation: 'scan-skip', path: 'artifacts/mascot.jpg' }),
      ]);
    });
  });
});
