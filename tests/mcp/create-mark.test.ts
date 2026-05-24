import { describe, expect, it } from 'vitest';

import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('MCP create_mark', () => {
  it('creates a private mark packet through MCP', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'mcp-mark-app' });
      const harness = await createMcpHarness(createNotchMcpServer({ cwd: project.path, includePrivate: true }));

      try {
        await expect(harness.listTools()).resolves.toContain('create_mark');
        const result = await harness.callTool('create_mark', {
          summary: 'Remember this implementation finding.',
          tags: ['implementation'],
        }) as { structuredContent: { packet: { purpose: string; sensitivity: string }; path: string } };

        expect(result.structuredContent.packet).toMatchObject({
          purpose: 'seed',
          sensitivity: 'private',
        });
        expect(result.structuredContent.path).toContain('.notch/private/inbox');
      } finally {
        await harness.close();
      }
    });
  });
});
