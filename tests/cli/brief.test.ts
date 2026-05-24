import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch brief', () => {
  it('shows the default project brief', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'brief-app'], { cwd: project.path });

      const result = await runCli(['brief'], { cwd: project.path });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('recordType: project_brief');
      expect(result.stdout).toContain('## Current Focus');
    });
  });

  it('emits the default project brief as JSON', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'brief-app'], { cwd: project.path });

      const result = await runCli(['--json', 'brief'], { cwd: project.path });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        brief: { recordType: 'project_brief', projectName: 'brief-app' },
      });
    });
  });
});
