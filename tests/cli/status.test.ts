import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch status', () => {
  it('prints counts for a fresh store', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'status-app'], { cwd: project.path });

      const result = await runCli(['--json', 'status'], { cwd: project.path });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        projectName: 'status-app',
        counts: {
          targetedBriefs: 0,
          inboxPackets: 0,
          outboxPackets: 0,
          privateSeedPackets: 0,
        },
      });
    });
  });
});
