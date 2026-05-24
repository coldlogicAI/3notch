import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { describe, expect, it } from 'vitest';

import { createMcpHarness } from '../helpers/mcp-harness.js';
import { runCli } from '../helpers/run-cli.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('test harness helpers', () => {
  it('creates and cleans up isolated temp projects', async () => {
    await withTempProject({ git: true }, async (project) => {
      expect(project.path).toContain('notch-test-');

      const result = await runCli(['--version'], { cwd: project.path });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout.trim()).toBe('0.3.0');
    });
  });

  it('creates a bare .notch store fixture', async () => {
    await withTempProject({}, async (project) => {
      const storePath = await createBareStore(project.path, { name: 'fixture-app' });

      expect(storePath).toContain('.notch');
      expect(await runCli(['--help'], { cwd: project.path })).toMatchObject({ exitCode: 0 });
    });
  });

  it('connects a no-op MCP server over in-memory transport', async () => {
    const server = new McpServer({ name: 'noop-3notch-test-server', version: '1.0.0' });
    server.tool('noop', () => ({ content: [{ type: 'text', text: 'ok' }] }));
    const harness = await createMcpHarness(server);

    try {
      await expect(harness.client.ping()).resolves.toEqual({});
      await expect(harness.listTools()).resolves.toEqual(['noop']);
      await expect(harness.callTool('noop')).resolves.toMatchObject({
        content: [{ type: 'text', text: 'ok' }],
      });
    } finally {
      await harness.close();
    }
  });
});
