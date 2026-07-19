import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch doctor', () => {
  it('reports a fresh store as healthy and rebuilds derived indexes', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'doctor-app'], { cwd: project.path });
      await rm(path.join(project.path, '.notch/index'), { recursive: true, force: true });

      const result = await runCli(['--json', 'doctor', '--fix', '--yes'], { cwd: project.path });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        healthy: true,
        checks: expect.arrayContaining([
          expect.objectContaining({ code: 'NOTCH_INDEX_REBUILT' }),
          expect.objectContaining({ code: 'NOTCH_CHECK_SUMMARY' }),
        ]),
      });
    });
  });

  it('reports Claude Code continuation wiring drift with the exact resync command', async () => {
    await withTempProject({}, async (project) => {
      await runCli([
        'onboard', '--yes', '--name', 'doctor-hooks', '--mcp', 'claude-code', '--checkpoints', 'auto', '--checkpoint-stop',
      ], { cwd: project.path });
      const settingsPath = path.join(project.path, '.claude/settings.local.json');
      const settings = JSON.parse(await readFile(settingsPath, 'utf8')) as Record<string, unknown>;
      await writeFile(settingsPath, `${JSON.stringify({ ...settings, hooks: {} }, null, 2)}\n`, 'utf8');

      const result = await runCli(['--json', 'doctor'], { cwd: project.path });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        healthy: true,
        checks: expect.arrayContaining([
          expect.objectContaining({ code: 'NOTCH_CLAUDE_HOOKS_DRIFT', severity: 'warn' }),
        ]),
        errors: expect.arrayContaining([
          expect.objectContaining({
            code: 'NOTCH_CLAUDE_HOOKS_DRIFT',
            recovery: 'notch onboard --yes --mcp claude-code --checkpoints auto --checkpoint-stop',
          }),
        ]),
      });
    });
  });
});
