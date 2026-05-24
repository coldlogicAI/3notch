import { describe, expect, it } from 'vitest';

import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('e2e private context seed smoke', () => {
  it('imports private seed context and hides it from MCP unless includePrivate is set', async () => {
    await withTempProject({ prefix: 'notch-e2e-old-' }, async (oldProject) => {
      await withTempProject({ prefix: 'notch-e2e-new-' }, async (newProject) => {
        await runCli(['onboard', '--yes', '--name', 'old-app'], { cwd: oldProject.path });
        await runCli(['onboard', '--yes', '--name', 'new-app'], { cwd: newProject.path });

        const seed = await runCli(['--json', 'seed', 'from', oldProject.path, '--review'], {
          cwd: newProject.path,
        });
        expect(seed.exitCode).toBe(0);
        expect(JSON.parse(seed.stdout)).toMatchObject({ inboxPath: expect.stringContaining('.notch/private/inbox') });

        const hiddenHarness = await createMcpHarness(createNotchMcpServer({ cwd: newProject.path }));
        try {
          await expect(hiddenHarness.callTool('list_packets', { includePrivate: true, purpose: 'seed' })).resolves.toMatchObject({
            structuredContent: { packets: [], warnings: [expect.objectContaining({ code: 'NOTCH_PRIVATE_HIDDEN' })] },
          });
        } finally {
          await hiddenHarness.close();
        }

        const privateHarness = await createMcpHarness(createNotchMcpServer({ cwd: newProject.path, includePrivate: true }));
        try {
          const visible = await privateHarness.callTool('list_packets', { includePrivate: true, purpose: 'seed' }) as {
            structuredContent: { packets: Array<{ packet: { purpose: string } }> };
          };
          expect(visible.structuredContent.packets).toEqual(
            expect.arrayContaining([expect.objectContaining({ packet: expect.objectContaining({ purpose: 'seed' }) })]),
          );
        } finally {
          await privateHarness.close();
        }
      });
    });
  }, 20_000);
});
