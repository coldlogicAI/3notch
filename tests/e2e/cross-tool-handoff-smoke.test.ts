import { describe, expect, it } from 'vitest';

import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('e2e cross-tool handoff smoke', () => {
  it('creates a packet from explicit MCP session context and imports it into another store', async () => {
    await withTempProject({ prefix: 'notch-e2e-tool-source-' }, async (source) => {
      await withTempProject({ prefix: 'notch-e2e-tool-dest-' }, async (destination) => {
        await runCli(['onboard', '--yes', '--name', 'tool-source'], { cwd: source.path });
        await runCli(['onboard', '--yes', '--name', 'tool-destination'], { cwd: destination.path });

        const harness = await createMcpHarness(createNotchMcpServer({ cwd: source.path }));
        let outboxPath: string | undefined;
        try {
          const created = await harness.callTool('create_packet', {
            title: 'Claude Desktop session handoff',
            summary: 'Explicit selected session context for Codex implementation.',
            toAgent: 'codex',
            sourceLinks: [{ kind: 'url', url: 'https://example.invalid/session-note', label: 'selected summary' }],
            importNotes: 'Use only the selected summary. Do not assume access to hidden chat history.',
          }) as { structuredContent: { outboxPath: string } };
          outboxPath = created.structuredContent.outboxPath;
        } finally {
          await harness.close();
        }

        if (!outboxPath) {
          throw new Error('MCP create_packet did not return an outbox path.');
        }
        const imported = await runCli(['packet', 'import', outboxPath], { cwd: destination.path });
        expect(imported.exitCode).toBe(0);
        await expect(runCli(['packet', 'list', '--inbox'], { cwd: destination.path })).resolves.toMatchObject({
          stdout: expect.stringContaining('Claude Desktop session handoff'),
        });
      });
    });
  }, 20_000);
});
