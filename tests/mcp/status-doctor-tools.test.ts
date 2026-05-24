import { describe, expect, it } from 'vitest';

import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('MCP status and doctor tools', () => {
  it('returns status and doctor diagnostics', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'mcp-status-app' });
      const harness = await createMcpHarness(createNotchMcpServer({ cwd: project.path }));

      try {
        await expect(harness.callTool('get_status', {})).resolves.toMatchObject({
          structuredContent: { projectName: 'mcp-status-app' },
        });
        await expect(harness.callTool('run_doctor', {})).resolves.toMatchObject({
          structuredContent: { healthy: true },
        });
      } finally {
        await harness.close();
      }
    });
  });
});
