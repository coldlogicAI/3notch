import { copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch corrupt store handling', () => {
  it('reports corrupt Markdown records during doctor', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'corrupt-store'], { cwd: project.path });
      await writeFile(path.join(project.path, '.notch/inbox/bad.md'), '---\nrecordType: [\n---\n', 'utf8');

      const result = await runCli(['--json', 'doctor'], { cwd: project.path });

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        healthy: false,
        checks: expect.arrayContaining([expect.objectContaining({ code: 'NOTCH_RECORD_INVALID' })]),
      });
    });
  });

  it('reports duplicate record IDs during doctor', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'duplicate-store'], { cwd: project.path });
      const created = await runCli([
        '--json',
        'brief',
        'create',
        '--title',
        'Duplicate source',
        '--to',
        'codex',
        '--goal',
        'Create a duplicate ID fixture.',
      ], { cwd: project.path });
      const { path: briefPath } = JSON.parse(created.stdout) as { path: string };
      await copyFile(briefPath, path.join(project.path, '.notch/briefs/duplicate-copy.md'));

      const result = await runCli(['--json', 'doctor'], { cwd: project.path });

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        healthy: false,
        checks: expect.arrayContaining([expect.objectContaining({ code: 'NOTCH_RECORD_ID_DUPLICATE' })]),
      });
    });
  });
});
