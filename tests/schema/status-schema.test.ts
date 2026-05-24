import { describe, expect, it } from 'vitest';

import { schemaService } from '../../src/core/schema-service.js';
import type { ProjectStatusSummary } from '../../src/types/records.js';

describe('status schema', () => {
  it('validates project status summaries', () => {
    const status = {
      schemaVersion: '1.0.0',
      generatedAt: '2026-05-23T18:40:00Z',
      projectName: 'fixture-app',
      storePath: '/tmp/fixture-app/.notch',
      counts: {
        targetedBriefs: 1,
        inboxPackets: 0,
        outboxPackets: 1,
        privateSeedPackets: 0,
        validationIssues: 0,
      },
      recentInboxPackets: [],
      openBriefs: [{ id: 'brief_1', title: 'Brief', targetAgent: 'codex', tags: ['schemas'] }],
      warnings: [],
    } satisfies ProjectStatusSummary;

    expect(schemaService.validate<ProjectStatusSummary>('status', status).ok).toBe(true);
  });
});
