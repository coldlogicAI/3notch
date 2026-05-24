import { describe, expect, it } from 'vitest';

import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('e2e agent-driven handoff smoke', () => {
  it('creates a packet from one MCP client and reads it from another client on the same store', async () => {
    await withTempProject({ prefix: 'notch-e2e-agent-' }, async (project) => {
      await runCli(['onboard', '--yes', '--mcp', 'claude-code', '--name', 'same-store-app'], {
        cwd: project.path,
      });

      const sourceHarness = await createMcpHarness(createNotchMcpServer({
        cwd: project.path,
        defaultActor: 'Claude Code',
      }));
      let packetId: string | undefined;
      try {
        const created = await sourceHarness.callTool('create_packet', {
          title: 'Launch context for desktop',
          summary: 'Conversationally selected release notes and repo-state summary.',
          toAgent: 'claude-desktop',
          sourceLinks: [{ kind: 'file', path: 'README.md', label: 'release summary source' }],
          importNotes: 'Use this packet directly from the shared store; no import step is required.',
        }) as { structuredContent: { packet: { id: string } } };
        packetId = created.structuredContent.packet.id;
      } finally {
        await sourceHarness.close();
      }

      if (!packetId) {
        throw new Error('MCP create_packet did not return a packet ID.');
      }

      const destinationHarness = await createMcpHarness(createNotchMcpServer({
        cwd: project.path,
        defaultActor: 'Claude Desktop',
      }));
      try {
        const listed = await destinationHarness.callTool('list_packets', {
          direction: 'outbox',
        }) as { structuredContent: { packets: Array<{ packet: { id: string; title: string } }> } };
        expect(listed.structuredContent.packets).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              packet: expect.objectContaining({ id: packetId, title: 'Launch context for desktop' }),
            }),
          ]),
        );

        const read = await destinationHarness.callTool('get_packet', {
          direction: 'outbox',
          id: packetId,
          includeMarkdown: true,
        }) as { structuredContent: { markdown: string; packet: { id: string } } };
        expect(read.structuredContent.packet.id).toBe(packetId);
        expect(read.structuredContent.markdown).toContain('Conversationally selected release notes');
      } finally {
        await destinationHarness.close();
      }
    });
  }, 20_000);
});
