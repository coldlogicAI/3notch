import { rm } from 'node:fs/promises';
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
        checks: expect.arrayContaining([expect.objectContaining({ code: 'NOTCH_INDEX_REBUILT' })]),
      });
    });
  });
});
