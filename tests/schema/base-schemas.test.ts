import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { schemaService } from '../../src/core/schema-service.js';
import type { AuditEntry, NotchConfig } from '../../src/types/records.js';

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures');

async function readJsonFixture<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(fixturesDir, name), 'utf8')) as T;
}

describe('base schemas', () => {
  it('validates V1 config with telemetry disabled and file-scan index', async () => {
    const config = await readJsonFixture<NotchConfig>('config-valid.json');
    const result = schemaService.validate<NotchConfig>('config', config);

    expect(result.ok).toBe(true);
  });

  it('validates continuation config and rejects unsupported Claude events', async () => {
    const config = await readJsonFixture<NotchConfig>('config-valid.json');
    config.continuation = {
      mode: 'prompt',
      sensitivity: 'private',
      streamOverride: 'auth-redesign',
      semanticTriggers: ['Before switching agents'],
      claudeCode: {
        events: ['SessionStart', 'PostCompact', 'StopFailure:rate_limit'],
      },
    };

    expect(schemaService.validate<NotchConfig>('config', config).ok).toBe(true);

    const invalid = structuredClone(config) as unknown as {
      continuation: { claudeCode: { events: string[] } };
    };
    invalid.continuation.claudeCode.events = ['PreCompact'];
    expect(schemaService.validate<NotchConfig>('config', invalid).ok).toBe(false);
  });

  it('rejects forbidden config values', async () => {
    const config = await readJsonFixture<NotchConfig>('config-invalid.json');
    const result = schemaService.validate<NotchConfig>('config', config);

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.map((error) => error.field).join('\n')).toContain('/privacy/telemetry');
  });

  it('validates audit entries with separate actor name and type resolution fields', () => {
    const audit = {
      schemaVersion: '1.0.0',
      at: '2026-05-23T18:00:00Z',
      operation: 'create',
      result: 'success',
      actor: { actorType: 'agent', name: 'Codex' },
      actorNameResolution: 'mcp-client',
      actorTypeResolution: 'mcp-default',
      sourceTool: { name: 'notch-mcp', client: 'codex' },
      recordType: 'packet',
      recordId: 'packet_1',
      recordPath: '.notch/outbox/packet.md',
    } satisfies AuditEntry;

    expect(schemaService.validate<AuditEntry>('audit', audit).ok).toBe(true);
  });
});
