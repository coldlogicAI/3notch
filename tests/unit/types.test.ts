import { describe, expect, it } from 'vitest';

import type { NotchError } from '../../src/types/errors.js';
import type { AuditEntry, NotchBrief, NotchConfig, NotchPacket, ProjectBrief } from '../../src/types/records.js';

describe('core record and error types', () => {
  it('models the V1 config contract without telemetry', () => {
    const config = {
      schemaVersion: '1.0.0',
      project: { name: 'fixture-app', root: '/tmp/fixture-app' },
      store: { path: '.notch', recordFormat: 'markdown-yaml', index: { enabled: true, engine: 'file-scan' } },
      privacy: {
        telemetry: false,
        redactPatterns: [{ kind: 'regex', value: 'secret', flags: 'i' }],
        secretScan: true,
        highEntropySecretScan: true,
      },
      defaults: { allowedMcpWriteTools: ['create_packet'] },
    } satisfies NotchConfig;

    expect(config.privacy.telemetry).toBe(false);
  });

  it('keeps briefs, packets, project briefs, audit entries, and errors structurally distinct', () => {
    const actor = { actorType: 'human', name: 'Test User' } as const;
    const sourceTool = { name: 'notch-cli' } as const;
    const baseMeta = {
      id: 'record_1',
      schemaVersion: '1.0.0',
      status: 'active' as const,
      createdAt: '2026-05-23T18:00:00Z',
      createdBy: actor,
      sourceTool,
      tags: [] as string[],
      sourceLinks: [],
      reviewStatus: 'reviewed' as const,
    };

    const projectBrief = {
      ...baseMeta,
      recordType: 'project_brief',
      projectName: 'fixture-app',
      currentFocus: [],
      activeConstraints: [],
      recentActivity: [],
      openThreads: [],
      warnings: [],
    } satisfies ProjectBrief;

    const brief = {
      ...baseMeta,
      recordType: 'brief',
      title: 'Targeted brief',
      targetAgent: 'codex',
      goal: 'Implement schemas',
      scope: { topics: [], files: [] },
      exclusions: [],
      relevantFiles: [],
      designBasis: 'Spec',
      priorReasoningSummary: 'None',
      constraints: [],
      recommendedNextSteps: [],
    } satisfies NotchBrief;

    const packet = {
      ...baseMeta,
      recordType: 'packet',
      title: 'Packet',
      purpose: 'handoff',
      sensitivity: 'project',
      transferStatus: 'outbox',
      origin: { projectName: 'source', storePath: '/tmp/source/.notch' },
      recipient: { targetAgent: 'codex' },
      summary: 'Context packet',
      includedRecords: [],
      includedSourceLinks: [],
    } satisfies NotchPacket;

    const audit = {
      schemaVersion: '1.0.0',
      at: '2026-05-23T18:00:00Z',
      operation: 'create',
      result: 'success',
      actor,
      actorNameResolution: 'cli-flag',
      actorTypeResolution: 'cli-default',
      sourceTool,
      recordType: 'packet',
      recordId: packet.id,
    } satisfies AuditEntry;

    const error = {
      code: 'NOTCH_RECORD_INVALID',
      message: 'Record is invalid.',
      severity: 'error',
      exitCode: 1,
    } satisfies NotchError;

    expect(projectBrief.recordType).toBe('project_brief');
    expect(brief.recordType).toBe('brief');
    expect(packet.recordType).toBe('packet');
    expect(audit.recordId).toBe('record_1');
    expect(error.code).toBe('NOTCH_RECORD_INVALID');
  });
});
