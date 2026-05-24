import { describe, expect, it } from 'vitest';

import { createPacket } from '../../src/core/packet-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('MCP create_reply', () => {
  it('creates a typed reply through MCP', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'mcp-reply-app' });
      const context = await loadConfig({ cwd: project.path });
      const parent = await createPacket(context, {
        summary: 'Parent state.',
        title: 'Parent state',
        toAgent: 'codex',
      });
      const harness = await createMcpHarness(createNotchMcpServer({ cwd: project.path }));

      try {
        await expect(harness.listTools()).resolves.toContain('create_reply');
        const result = await harness.callTool('create_reply', {
          parentId: parent.packet.id,
          replyType: 'clarification',
          summary: 'Clarify this state.',
        }) as { structuredContent: { packet: { replyTo: string; replyType: string; status: string } } };

        expect(result.structuredContent.packet).toMatchObject({
          replyTo: parent.packet.id,
          replyType: 'clarification',
          status: 'open',
        });
      } finally {
        await harness.close();
      }
    });
  });
});
