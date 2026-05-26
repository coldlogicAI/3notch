import { describe, expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('e2e cross-repo packet smoke', () => {
  it('creates a packet in repo A, imports it into repo B, and reads it through CLI and MCP', async () => {
    await withTempProject({ prefix: 'notch-e2e-source-' }, async (source) => {
      await withTempProject({ prefix: 'notch-e2e-dest-' }, async (destination) => {
        await runCli(['onboard', '--yes', '--name', 'source-app'], { cwd: source.path });
        await runCli(['onboard', '--yes', '--name', 'destination-app'], { cwd: destination.path });
        await mkdir(path.join(source.path, 'src'), { recursive: true });
        await writeFile(path.join(source.path, 'src/index.ts'), 'export const state = "ready";\n', 'utf8');
        await runCli([
          'brief',
          'create',
          '--title',
          'Packet basis',
          '--to',
          'codex',
          '--goal',
          'Carry packet context',
          '--topic',
          'packets',
        ], { cwd: source.path });

        const createPacket = await runCli([
          '--json',
          'packet',
          'create',
          '--title',
          'Repo state',
          '--summary',
          'Current repo state for downstream implementation.',
          '--to-agent',
          'codex',
          '--to-repo',
          destination.path,
          '--file',
          'src/index.ts',
        ], { cwd: source.path });
        const created = JSON.parse(createPacket.stdout) as { outboxPath: string; packet: { id: string } };
        const importPacket = await runCli(['packet', 'import', created.outboxPath], { cwd: destination.path });
        expect(importPacket.exitCode).toBe(0);

        await expect(runCli(['packet', 'show', created.packet.id, '--inbox'], { cwd: destination.path })).resolves.toMatchObject({
          exitCode: 0,
          stdout: expect.stringContaining('Current repo state for downstream implementation.'),
        });
        await expect(runCli(['doctor', '--fix', '--yes'], { cwd: destination.path })).resolves.toMatchObject({ exitCode: 0 });
        await expect(runCli(['--json', 'status'], { cwd: destination.path })).resolves.toMatchObject({ exitCode: 0 });

        const harness = await createMcpHarness(createNotchMcpServer({ cwd: destination.path }));
        try {
          await expect(harness.callTool('get_packet', { id: created.packet.id })).resolves.toMatchObject({
            structuredContent: { packet: { id: created.packet.id } },
          });
        } finally {
          await harness.close();
        }
      });
    });
  }, 20_000);
});
