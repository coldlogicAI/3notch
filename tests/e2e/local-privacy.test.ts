import { describe, expect, it } from 'vitest';

import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('e2e local privacy smoke', () => {
  it('does not expose shell, scraping, or arbitrary read tools through MCP', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'privacy-app'], { cwd: project.path });
      const harness = await createMcpHarness(createNotchMcpServer({ cwd: project.path }));

      try {
        const tools = await harness.listTools();
        expect(tools).not.toEqual(expect.arrayContaining([
          'shell',
          'exec',
          'read_file',
          'read_project',
          'read_chat',
          'scrape_chat',
          'create_pass',
          'notch_send',
        ]));
      } finally {
        await harness.close();
      }
    });
  });
});
