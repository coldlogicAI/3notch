import { describe, expect, it } from 'vitest';

import { createRecordMeta, normalizeTags } from '../../src/core/record-factory.js';

describe('record factory', () => {
  it('creates metadata with actor, timestamp, source tool, record type, and schema version', () => {
    const created = createRecordMeta({
      actor: 'Alex',
      date: new Date('2026-05-23T18:00:00Z'),
      recordType: 'packet',
      tags: ['V1', 'v1', 'context packets'],
      title: 'Auth handoff',
    });

    expect(created.meta).toMatchObject({
      createdAt: '2026-05-23T18:00:00.000Z',
      createdBy: { actorType: 'human', name: 'Alex' },
      id: 'packet_20260523T180000Z_auth_handoff',
      recordType: 'packet',
      reviewStatus: 'reviewed',
      schemaVersion: '1.0.0',
      sourceTool: { name: 'notch-cli' },
    });
    expect(created.slug).toBe('auth-handoff');
    expect(created.meta.tags).toEqual(['v1', 'context-packets']);
  });

  it('marks CLI --agent writes as agent authored and unreviewed', () => {
    const created = createRecordMeta({
      agent: 'Codex',
      date: new Date('2026-05-23T18:00:00Z'),
      recordType: 'brief',
      title: 'Schema work',
    });

    expect(created.meta.createdBy.actorType).toBe('agent');
    expect(created.meta.reviewStatus).toBe('unreviewed');
  });

  it('normalizes and de-duplicates tags', () => {
    expect(normalizeTags(['  V1! ', 'v1', 'packet transfer'])).toEqual(['v1', 'packet-transfer']);
  });
});
