import { describe, expect, it } from 'vitest';

import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('MCP read-only mode', () => {
  it('rejects write tools in read-only mode', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'mcp-readonly-app' });
      const harness = await createMcpHarness(createNotchMcpServer({ cwd: project.path, readOnly: true }));

      try {
        await expect(harness.callTool('create_packet', {
          title: 'Should fail',
          summary: 'No writes allowed.',
          toAgent: 'codex',
        })).resolves.toMatchObject({
          isError: true,
          structuredContent: { error: { code: 'NOTCH_MCP_READ_ONLY' } },
        });
      } finally {
        await harness.close();
      }
    });
  });
});
