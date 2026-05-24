import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch brief create/list/show', () => {
  it('creates, lists, and shows targeted briefs by ID', async () => {
    await withTempProject({ git: true }, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'target-app'], { cwd: project.path });
      const create = await runCli(
        [
          '--json',
          '--agent',
          'Codex',
          'brief',
          'create',
          '--title',
          'Implement packet transfer',
          '--to',
          'codex',
          '--goal',
          'Implement packet transfer services',
          '--topic',
          'packets',
          '--file',
          'src/core/packet-service.ts',
          '--exclude',
          'No cloud sync',
          '--tag',
          'packets',
        ],
        { cwd: project.path },
      );

      expect(create.exitCode).toBe(0);
      const created = JSON.parse(create.stdout) as { brief: { id: string; reviewStatus: string; createdBy: { actorType: string } } };
      expect(created.brief.createdBy.actorType).toBe('agent');
      expect(created.brief.reviewStatus).toBe('unreviewed');

      const list = await runCli(['--json', 'brief', 'list', '--to', 'codex', '--tag', 'packets'], {
        cwd: project.path,
      });
      expect(list.exitCode).toBe(0);
      expect(JSON.parse(list.stdout)).toMatchObject({
        briefs: [expect.objectContaining({ id: created.brief.id, title: 'Implement packet transfer' })],
      });

      const show = await runCli(['brief', 'show', created.brief.id], { cwd: project.path });
      expect(show.exitCode).toBe(0);
      expect(show.stdout).toContain('## Goal For codex');
      expect(show.stdout).toContain('Implement packet transfer services');

      const partialShow = await runCli(['--json', 'brief', 'show', 'packet'], { cwd: project.path });
      expect(partialShow.exitCode).toBe(1);
      expect(JSON.parse(partialShow.stderr)).toMatchObject({
        error: { code: 'NOTCH_RECORD_NOT_FOUND' },
      });
    });
  });

  it('rejects unsafe scope paths', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes'], { cwd: project.path });
      const result = await runCli(
        [
          'brief',
          'create',
          '--title',
          'Unsafe',
          '--to',
          'codex',
          '--goal',
          'Test unsafe path',
          '--file',
          '../outside.ts',
        ],
        { cwd: project.path },
      );

      expect(result.exitCode).toBe(5);
      expect(result.stderr).toContain('NOTCH_PATH_OUTSIDE_PROJECT');
    });
  });
});
