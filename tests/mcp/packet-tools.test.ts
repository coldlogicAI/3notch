import { describe, expect, it } from 'vitest';

import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('MCP packet tools', () => {
  it('creates, imports, lists, and gets packets without exposing private packets by default', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'mcp-packet-app' });
      const server = createNotchMcpServer({ cwd: project.path });
      const harness = await createMcpHarness(server);

      try {
        const created = await harness.callTool('create_packet', {
          title: 'MCP packet',
          summary: 'Explicit MCP supplied context.',
          toAgent: 'codex',
          sourceLinks: [{ kind: 'file', path: 'src/index.ts' }],
        }) as { structuredContent: { outboxPath: string; packet: { id: string } } };

        await expect(harness.callTool('list_packets', { direction: 'outbox' })).resolves.toMatchObject({
          structuredContent: { packets: [expect.objectContaining({ packet: expect.objectContaining({ id: created.structuredContent.packet.id }) })] },
        });
        await expect(harness.callTool('get_packet', { id: created.structuredContent.packet.id })).resolves.toMatchObject({
          structuredContent: { packet: { title: 'MCP packet' } },
        });

        const imported = await harness.callTool('import_packet', {
          packetPath: created.structuredContent.outboxPath,
          asReviewed: true,
        }) as { structuredContent: { inboxPath: string } };
        expect(imported.structuredContent.inboxPath).toContain('.notch/inbox');

        await harness.callTool('create_seed_packet', {
          title: 'Private MCP seed',
          summary: 'Reviewed private workflow context.',
        });

        await expect(harness.callTool('list_packets', { includePrivate: true, purpose: 'seed' })).resolves.toMatchObject({
          structuredContent: {
            packets: [],
            warnings: [expect.objectContaining({ code: 'NOTCH_PRIVATE_HIDDEN' })],
          },
        });
      } finally {
        await harness.close();
      }
    });
  });

  it('exposes private packets only when the server is started with includePrivate', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'mcp-private-app' });
      const writer = await createMcpHarness(createNotchMcpServer({ cwd: project.path }));

      try {
        await writer.callTool('create_seed_packet', {
          title: 'Private MCP seed',
          summary: 'Reviewed private workflow context.',
        });
      } finally {
        await writer.close();
      }

      const reader = await createMcpHarness(createNotchMcpServer({ cwd: project.path, includePrivate: true }));

      try {
        await expect(reader.callTool('list_packets', { includePrivate: true, purpose: 'seed' })).resolves.toMatchObject({
          structuredContent: { packets: [expect.objectContaining({ packet: expect.objectContaining({ purpose: 'seed' }) })] },
        });
      } finally {
        await reader.close();
      }
    });
  });
});
