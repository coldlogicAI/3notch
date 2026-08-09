import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createPacketArchive } from '../../src/core/archive-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import { createPacket } from '../../src/core/packet-service.js';
import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('durable inbox MCP tools', () => {
  it('runs the complete cross-store send, list, pull/import, and ack workflow with structured results', async () => {
    await withTempProject({}, async (sender) => {
      await withTempProject({}, async (receiver) => {
        await createBareStore(sender.path, { name: 'sender' });
        await createBareStore(receiver.path, { name: 'receiver' });
        const senderHarness = await createMcpHarness(createNotchMcpServer({ cwd: sender.path, defaultActor: 'Sender Model' }));
        const receiverHarness = await createMcpHarness(createNotchMcpServer({ cwd: receiver.path, defaultActor: 'Receiver Model' }));
        const mailboxRoot = path.join(sender.path, 'mailbox');

        try {
          await expect(senderHarness.callTool('inbox_init', {
            name: 'sender-model',
            root: mailboxRoot,
          })).resolves.toMatchObject({
            structuredContent: { ok: true, address: 'local:sender-model' },
          });
          await expect(receiverHarness.callTool('inbox_init', {
            name: 'receiver-model',
            root: mailboxRoot,
          })).resolves.toMatchObject({
            structuredContent: { ok: true, address: 'local:receiver-model' },
          });

          const packed = await packPacket(sender.path);
          const send = await senderHarness.callTool('send_packet', {
            packetPath: packed.archivePath,
            to: 'local:receiver-model',
          }) as { structuredContent: { deliveryId: string; notice: string; packetHash: string } };
          expect(send).toMatchObject({
            structuredContent: {
              deliveryId: expect.stringMatching(/^delivery_[a-f0-9]{24}$/u),
              packetHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
              state: 'pending',
              idempotent: false,
              notice: expect.stringContaining('3Notch delivery notice'),
            },
          });
          expect(send.structuredContent.notice).toContain(`notch inbox pull ${send.structuredContent.deliveryId} --import`);

          await expect(receiverHarness.callTool('list_inbox')).resolves.toMatchObject({
            structuredContent: {
              address: 'local:receiver-model',
              deliveries: [expect.objectContaining({ deliveryId: send.structuredContent.deliveryId })],
            },
          });
          await expect(receiverHarness.callTool('pull_inbox_packet', {
            deliveryId: send.structuredContent.deliveryId,
            import: true,
          })).resolves.toMatchObject({
            structuredContent: {
              deliveryId: send.structuredContent.deliveryId,
              importedPacketId: packed.packetId,
              state: 'pulled',
            },
          });
          await expect(receiverHarness.callTool('ack_inbox_delivery', {
            deliveryId: send.structuredContent.deliveryId,
          })).resolves.toMatchObject({
            structuredContent: {
              deliveryId: send.structuredContent.deliveryId,
              state: 'acked',
            },
          });
          await expect(senderHarness.callTool('get_inbox_delivery', {
            deliveryId: send.structuredContent.deliveryId,
            address: 'local:receiver-model',
          })).resolves.toMatchObject({
            structuredContent: {
              address: 'local:receiver-model',
              deliveryId: send.structuredContent.deliveryId,
              delivery: expect.objectContaining({ state: 'acked', importedPacketId: packed.packetId }),
              nextAction: expect.stringContaining('acknowledged'),
              state: 'acked',
            },
          });
          await expect(receiverHarness.callTool('list_inbox')).resolves.toMatchObject({
            structuredContent: { deliveries: [] },
          });
          await expect(receiverHarness.callTool('list_inbox', { includeAll: true })).resolves.toMatchObject({
            structuredContent: { deliveries: [expect.objectContaining({ state: 'acked' })] },
          });
        } finally {
          await senderHarness.close();
          await receiverHarness.close();
        }
      });
    });
  });

  it('advertises accurate titles, output schemas, and safety annotations', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'metadata' });
      const harness = await createMcpHarness(createNotchMcpServer({ cwd: project.path }));

      try {
        const response = await harness.client.listTools();
        const tools = new Map(response.tools.map((tool) => [tool.name, tool]));
        expect(tools.get('send_packet')).toMatchObject({
          title: 'Send packed packet',
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            openWorldHint: true,
          },
          outputSchema: expect.objectContaining({ type: 'object' }),
        });
        expect(tools.get('list_inbox')).toMatchObject({
          title: 'List durable inbox',
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false,
          },
          outputSchema: expect.objectContaining({ type: 'object' }),
        });
        expect(tools.get('get_inbox_delivery')).toMatchObject({
          title: 'Get inbox delivery',
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false,
          },
          outputSchema: expect.objectContaining({ type: 'object' }),
        });
        expect(tools.get('ack_inbox_delivery')?.description).toContain('never deletes');
      } finally {
        await harness.close();
      }
    });
  });

  it('enforces MCP read-only mode and absolute-path setup boundaries', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'read-only-inbox' });
      const writable = await createMcpHarness(createNotchMcpServer({ cwd: project.path }));
      const readOnly = await createMcpHarness(createNotchMcpServer({ cwd: project.path, readOnly: true }));

      try {
        await expect(writable.callTool('inbox_init', {
          name: 'receiver',
          root: 'relative/mailbox',
        })).resolves.toMatchObject({
          isError: true,
          structuredContent: { error: { code: 'NOTCH_MCP_PATH_INVALID' } },
        });
        await expect(readOnly.callTool('inbox_init', {
          name: 'receiver',
          root: path.join(project.path, 'mailbox'),
        })).resolves.toMatchObject({
          isError: true,
          structuredContent: { error: { code: 'NOTCH_MCP_READ_ONLY' } },
        });
        await expect(readOnly.callTool('list_inbox')).resolves.toMatchObject({
          isError: true,
          structuredContent: { error: { code: 'NOTCH_INBOX_NOT_CONFIGURED' } },
        });
      } finally {
        await writable.close();
        await readOnly.close();
      }
    });
  });

  it('rejects reviewed-without-import and invalid schema arguments before state change', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'schema-guard' });
      const harness = await createMcpHarness(createNotchMcpServer({ cwd: project.path }));

      try {
        await expect(harness.callTool('pull_inbox_packet', {
          deliveryId: 'delivery_aaaaaaaaaaaaaaaaaaaaaaaa',
          asReviewed: true,
        })).resolves.toMatchObject({
          isError: true,
          structuredContent: { error: { code: 'NOTCH_INBOX_IMPORT_REQUIRED' } },
        });
        await expect(harness.callTool('send_packet', {
          packetPath: '/tmp/packet.notchpkt',
          to: 'local:../escape',
        })).resolves.toMatchObject({ isError: true });
      } finally {
        await harness.close();
      }
    });
  });
});

async function packPacket(projectPath: string): Promise<{ archivePath: string; packetId: string }> {
  const context = await loadConfig({ cwd: projectPath });
  const created = await createPacket(context, {
    summary: 'MCP durable inbox handoff.',
    title: 'MCP durable inbox',
    toAgent: 'receiver-model',
  });
  const archive = await createPacketArchive({
    markdownPath: created.outboxPath,
    rootPath: created.outboxPath,
  });
  const archivePath = path.join(projectPath, `${created.packet.id}.notchpkt`);
  await writeFile(archivePath, archive);
  return { archivePath, packetId: created.packet.id };
}
