import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

import { createPacket, getPacket, listPackets } from '../../src/core/packet-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import { readAuditLog } from '../../src/core/audit-service.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

const execFileAsync = promisify(execFile);

describe('packet service', () => {
  it('creates, lists, and reads project handoff packets', async () => {
    await withTempProject({ git: true }, async (project) => {
      await createBareStore(project.path, { name: 'source-app' });
      const context = await loadConfig({ cwd: project.path });

      const created = await createPacket(context, {
        sourceLinks: [{ kind: 'file', path: 'src/index.ts' }],
        summary: 'Current implementation state for destination work.',
        title: 'Current implementation state',
        toAgent: 'codex',
        toRepo: '../destination-app',
      });

      expect(created.packet.transferStatus).toBe('outbox');
      expect(created.outboxPath).toContain('.notch/outbox');
      expect(await listPackets(context, { direction: 'outbox' })).toHaveLength(1);
      await expect(getPacket(context, created.packet.id)).resolves.toMatchObject({
        packet: { title: 'Current implementation state' },
      });
      expect(await readAuditLog(context.paths.logs)).toHaveLength(1);
    });
  });

  it('populates available Git provenance without requiring it', async () => {
    await withTempProject({ git: true }, async (project) => {
      await createBareStore(project.path, { name: 'git-source-app' });
      await writeFile(path.join(project.path, 'README.md'), '# Git source\n', 'utf8');
      await execFileAsync('git', ['add', 'README.md'], { cwd: project.path });
      await execFileAsync('git', ['commit', '-m', 'Initial commit'], { cwd: project.path });
      const branch = (await execFileAsync('git', ['branch', '--show-current'], { cwd: project.path })).stdout.trim();
      const commit = (await execFileAsync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: project.path })).stdout.trim();
      const context = await loadConfig({ cwd: project.path });

      const created = await createPacket(context, {
        summary: 'Git-backed packet.',
        title: 'Git-backed packet',
        toAgent: 'codex',
      });

      expect(created.packet.origin).toMatchObject({ branch, commit });
    });

    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'non-git-source-app' });
      const context = await loadConfig({ cwd: project.path });
      const created = await createPacket(context, {
        summary: 'Non-Git packet.',
        title: 'Non-Git packet',
        toAgent: 'codex',
      });

      expect(created.packet.origin).not.toHaveProperty('branch');
      expect(created.packet.origin).not.toHaveProperty('commit');
    });
  });

  it('requires every requested tag when listing packets', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'tag-filter-app' });
      const context = await loadConfig({ cwd: project.path });
      const matching = await createPacket(context, {
        summary: 'Matches both tags.',
        tags: ['continuation', 'Stream Feature A'],
        title: 'Matching packet',
        toAgent: 'codex',
      });
      await createPacket(context, {
        summary: 'Matches one tag.',
        tags: ['continuation'],
        title: 'Partial packet',
        toAgent: 'codex',
      });

      const packets = await listPackets(context, { tags: ['Continuation', 'stream feature a'] });

      expect(packets.map((entry) => entry.packet.id)).toEqual([matching.packet.id]);
    });
  });

  it('warns when an MCP-style packet summary is large and unsourced', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'source-app' });
      const context = await loadConfig({ cwd: project.path });
      const result = await createPacket(context, {
        summary: 'x'.repeat(5001),
        title: 'Large unsourced summary',
        toAgent: 'codex',
      });

      expect(result.warnings).toEqual([
        expect.objectContaining({ code: 'NOTCH_SUMMARY_LARGE' }),
      ]);
    });
  });

  it('records supersedes metadata in created packets and audit log', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'supersedes-app' });
      const context = await loadConfig({ cwd: project.path });
      const previous = await createPacket(context, {
        summary: 'Previous state.',
        title: 'Previous state',
        toAgent: 'codex',
      });
      const next = await createPacket(context, {
        summary: 'Next state.',
        supersedes: previous.packet.id,
        title: 'Next state',
        toAgent: 'codex',
      });
      const audit = await readAuditLog(context.paths.logs);

      expect(next.packet.supersedes).toBe(previous.packet.id);
      expect(audit).toEqual(expect.arrayContaining([
        expect.objectContaining({ recordId: next.packet.id, supersedes: previous.packet.id }),
      ]));
    });
  });
});
