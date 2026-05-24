import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch seed', () => {
  it('requires review for private context seeding', async () => {
    await withTempProject({}, async (oldProject) => {
      await withTempProject({}, async (newProject) => {
        await runCli(['onboard', '--yes', '--name', 'old-app'], { cwd: oldProject.path });
        await runCli(['onboard', '--yes', '--name', 'new-app'], { cwd: newProject.path });

        const result = await runCli(['seed', 'from', oldProject.path], { cwd: newProject.path });

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('NOTCH_SEED_REVIEW_REQUIRED');
      });
    });
  });

  it('imports reviewed private context into the private inbox', async () => {
    await withTempProject({}, async (oldProject) => {
      await withTempProject({}, async (newProject) => {
        await runCli(['onboard', '--yes', '--name', 'old-app'], { cwd: oldProject.path });
        await runCli(['onboard', '--yes', '--name', 'new-app'], { cwd: newProject.path });

        const result = await runCli(['--json', 'seed', 'from', oldProject.path, '--review'], {
          cwd: newProject.path,
        });

        expect(result.exitCode).toBe(0);
        expect(JSON.parse(result.stdout)).toMatchObject({
          inboxPath: expect.stringContaining('.notch/private/inbox'),
        });

        const hidden = await runCli(['--json', 'packet', 'list', '--purpose', 'seed'], {
          cwd: newProject.path,
        });
        expect(JSON.parse(hidden.stdout)).toMatchObject({ packets: [] });

        const visible = await runCli(['--json', 'packet', 'list', '--purpose', 'seed', '--private'], {
          cwd: newProject.path,
        });
        expect(JSON.parse(visible.stdout).packets.length).toBeGreaterThan(0);
      });
    });
  });
});
