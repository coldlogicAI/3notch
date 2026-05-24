import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch check', () => {
  it('exits 0 for a clean store', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'clean-check-cli'], { cwd: project.path });
      const result = await runCli(['check'], { cwd: project.path });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('no findings');
    });
  });

  it('reports deterministic findings as text and JSON', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'check-cli'], { cwd: project.path });
      await runCli([
        'packet',
        'create',
        '--title',
        'Broken edge',
        '--summary',
        'Broken edge summary.',
        '--to-agent',
        'codex',
        '--supersedes',
        'packet_missing_parent',
      ], { cwd: project.path });

      const text = await runCli(['check'], { cwd: project.path });
      const json = await runCli(['--json', 'check'], { cwd: project.path });
      const parsed = JSON.parse(json.stdout) as { findings: Array<{ rule: string }>; summary: { errors: number } };

      expect(text.exitCode).toBe(1);
      expect(text.stdout).toContain('CHECK_SUPERSEDES_BROKEN');
      expect(json.exitCode).toBe(1);
      expect(parsed.summary.errors).toBe(1);
      expect(parsed.findings).toEqual([
        expect.objectContaining({ rule: 'CHECK_SUPERSEDES_BROKEN' }),
      ]);
    });
  });
});
