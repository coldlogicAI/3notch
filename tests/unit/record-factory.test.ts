import { describe, expect, it } from 'vitest';

import { createRecordMeta, normalizeTags } from '../../src/core/record-factory.js';
import { withTempProject } from '../helpers/temp-project.js';

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

  it('tracks actor resolution from explicit CLI actor, git config, and MCP client', async () => {
    const explicit = createRecordMeta({
      actor: 'Alex',
      date: new Date('2026-05-23T18:00:00Z'),
      recordType: 'packet',
      title: 'Explicit actor',
    });
    expect(explicit.actorNameResolution).toBe('cli-flag');
    expect(explicit.actorTypeResolution).toBe('cli-default');

    await withTempProject({ git: true }, async (project) => {
      const fromGit = createRecordMeta({
        cwd: project.path,
        date: new Date('2026-05-23T18:00:00Z'),
        recordType: 'packet',
        title: 'Git actor',
      });

      expect(fromGit.meta.createdBy.name).toBe('3Notch Test');
      expect(fromGit.actorNameResolution).toBe('git-config');
      expect(fromGit.actorTypeResolution).toBe('cli-default');
    });

    const mcp = createRecordMeta({
      actor: 'Claude Desktop',
      date: new Date('2026-05-23T18:00:00Z'),
      mcp: true,
      recordType: 'packet',
      title: 'MCP actor',
    });
    expect(mcp.meta.createdBy.actorType).toBe('agent');
    expect(mcp.actorNameResolution).toBe('mcp-client');
    expect(mcp.actorTypeResolution).toBe('mcp-default');
  });

  it('tracks CLI --agent type resolution', () => {
    const created = createRecordMeta({
      agent: 'Codex',
      date: new Date('2026-05-23T18:00:00Z'),
      recordType: 'packet',
      title: 'Agent actor',
    });

    expect(created.actorNameResolution).toBe('cli-flag');
    expect(created.actorTypeResolution).toBe('cli-agent-flag');
  });

  it('normalizes and de-duplicates tags', () => {
    expect(normalizeTags(['  V1! ', 'v1', 'packet transfer'])).toEqual(['v1', 'packet-transfer']);
  });
});
