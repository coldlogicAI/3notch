import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('MCP packet tools', () => {
  it('creates, imports, lists, and gets packets without exposing private packets by default', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'mcp-packet-app' });
      await mkdir(path.join(project.path, 'src'), { recursive: true });
      await writeFile(path.join(project.path, 'src/index.ts'), 'export const mcp = true;\n', 'utf8');
      const server = createNotchMcpServer({ cwd: project.path });
      const harness = await createMcpHarness(server);

      try {
        const created = await harness.callTool('create_packet', {
          title: 'MCP packet',
          summary: 'Explicit MCP supplied context.',
          toAgent: 'codex',
          files: ['src/index.ts:source'],
          refs: ['src/index.ts'],
          nextSteps: 'Read artifacts/index.ts.',
        }) as { structuredContent: { outboxPath: string; packet: { id: string } } };
        expect(await readFile(path.join(path.dirname(created.structuredContent.outboxPath), 'artifacts/index.ts'), 'utf8')).toBe('export const mcp = true;\n');

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

  it('rejects MCP packet output paths outside the project root', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'mcp-output-guard' });
      const harness = await createMcpHarness(createNotchMcpServer({ cwd: project.path }));

      try {
        await expect(harness.callTool('create_packet', {
          outputPath: '../escape.md',
          summary: 'Reject escaping output path.',
          title: 'Escaping packet',
          toAgent: 'codex',
        })).resolves.toMatchObject({
          isError: true,
          structuredContent: { error: { code: 'NOTCH_PATH_OUTSIDE_PROJECT' } },
        });
        await expect(harness.callTool('create_seed_packet', {
          outputPath: path.join(project.path, '../seed-escape.md'),
          summary: 'Reject escaping seed output path.',
          title: 'Escaping seed packet',
        })).resolves.toMatchObject({
          isError: true,
          structuredContent: { error: { code: 'NOTCH_PATH_OUTSIDE_PROJECT' } },
        });
      } finally {
        await harness.close();
      }
    });
  });

  it('rejects relative MCP import paths', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'mcp-import-guard' });
      const harness = await createMcpHarness(createNotchMcpServer({ cwd: project.path }));

      try {
        await expect(harness.callTool('import_packet', { packetPath: '../packet.md' })).resolves.toMatchObject({
          isError: true,
          structuredContent: { error: { code: 'NOTCH_MCP_PACKET_PATH_INVALID' } },
        });
        await expect(harness.callTool('import_seed_packet', { packetPath: '../seed.md' })).resolves.toMatchObject({
          isError: true,
          structuredContent: { error: { code: 'NOTCH_MCP_PACKET_PATH_INVALID' } },
        });
      } finally {
        await harness.close();
      }
    });
  });

  it.skipIf(process.platform === 'win32')('rejects MCP import symlinks', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'mcp-symlink-guard' });
      const packetPath = path.join(project.path, 'packet.md');
      const linkPath = path.join(project.path, 'packet-link.md');
      await writeFile(packetPath, 'not a packet', 'utf8');
      await symlink(packetPath, linkPath);
      const harness = await createMcpHarness(createNotchMcpServer({ cwd: project.path }));

      try {
        await expect(harness.callTool('import_packet', { packetPath: linkPath })).resolves.toMatchObject({
          isError: true,
          structuredContent: { error: { code: 'NOTCH_SYMLINK_REJECTED' } },
        });
      } finally {
        await harness.close();
      }
    });
  });
});
