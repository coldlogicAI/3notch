import { gzipSync } from 'node:zlib';
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createPacketArchive } from '../../src/core/archive-service.js';
import { readAuditLog } from '../../src/core/audit-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import {
  ackInboxDelivery,
  initializeDurableInbox,
  listInboxDeliveries,
  pullInboxDelivery,
  sendInboxPacket,
} from '../../src/core/inbox-service.js';
import { createPacket } from '../../src/core/packet-service.js';
import type { NotchConfig, PacketPurpose, Sensitivity } from '../../src/types/records.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('durable inbox service', () => {
  it('completes init, send, verify, import, idempotent pull, ack, and redacted audit lifecycle', async () => {
    await withTempProject({}, async (sender) => {
      await withTempProject({}, async (receiver) => {
        await createBareStore(sender.path, { name: 'sender' });
        await createBareStore(receiver.path, { name: 'receiver' });
        const senderContext = await loadConfig({ cwd: sender.path });
        const receiverContext = await loadConfig({ cwd: receiver.path });
        const mailboxRoot = path.join(sender.path, 'mailbox');
        await initializeDurableInbox(senderContext, { name: 'sender', root: mailboxRoot });
        await initializeDurableInbox(receiverContext, { name: 'receiver', root: mailboxRoot });
        const packed = await packPacket(senderContext, sender.path, { title: 'Review request' });
        const sent = await sendInboxPacket(senderContext, {
          packetPath: packed.archivePath,
          to: 'local:receiver',
        });
        const retry = await sendInboxPacket(senderContext, {
          packetPath: packed.archivePath,
          to: 'local:receiver',
        });

        expect(sent.idempotent).toBe(false);
        expect(retry).toMatchObject({ deliveryId: sent.deliveryId, idempotent: true });
        expect(await listInboxDeliveries(receiverContext)).toMatchObject({
          deliveries: [expect.objectContaining({ deliveryId: sent.deliveryId, state: 'pending' })],
        });

        const verified = await pullInboxDelivery(receiverContext, { deliveryId: sent.deliveryId });
        const imported = await pullInboxDelivery(receiverContext, { deliveryId: sent.deliveryId, import: true });
        const importRetry = await pullInboxDelivery(receiverContext, { deliveryId: sent.deliveryId, import: true });
        const acked = await ackInboxDelivery(receiverContext, { deliveryId: sent.deliveryId });
        const ackRetry = await ackInboxDelivery(receiverContext, { deliveryId: sent.deliveryId });

        expect(verified).toMatchObject({ state: 'pulled', packetId: packed.packetId });
        expect(imported).toMatchObject({ state: 'pulled', importedPacketId: packed.packetId });
        expect(importRetry).toMatchObject({ importedPacketId: packed.packetId });
        expect(acked.state).toBe('acked');
        expect(ackRetry.state).toBe('acked');
        expect(await readFile(acked.packetPath)).toEqual(packed.archive);
        expect((await listInboxDeliveries(receiverContext)).deliveries).toEqual([]);
        expect(await listInboxDeliveries(receiverContext, { includeAll: true })).toMatchObject({
          deliveries: [expect.objectContaining({ state: 'acked', importedPacketId: packed.packetId })],
        });

        const senderAudit = await readAuditLog(senderContext.paths.logs);
        const receiverAudit = await readAuditLog(receiverContext.paths.logs);
        expect(senderAudit).toEqual(expect.arrayContaining([
          expect.objectContaining({ operation: 'inbox-init', result: 'success' }),
          expect.objectContaining({ operation: 'inbox-send', result: 'success', deliveryId: sent.deliveryId }),
          expect.objectContaining({ operation: 'inbox-send', reason: 'idempotent-retry' }),
        ]));
        expect(receiverAudit).toEqual(expect.arrayContaining([
          expect.objectContaining({ operation: 'inbox-pull', result: 'success', deliveryId: sent.deliveryId }),
          expect.objectContaining({ operation: 'inbox-ack', result: 'success', deliveryState: 'acked' }),
        ]));
        expect(JSON.stringify([...senderAudit, ...receiverAudit])).not.toContain('Review request summary.');
      });
    });
  });

  it('serializes simultaneous import pulls into one receiver packet and deterministic results', async () => {
    await withTempProject({}, async (sender) => {
      await withTempProject({}, async (receiver) => {
        await createBareStore(sender.path, { name: 'sender' });
        await createBareStore(receiver.path, { name: 'receiver' });
        const senderContext = await loadConfig({ cwd: sender.path });
        const receiverContext = await loadConfig({ cwd: receiver.path });
        const mailboxRoot = path.join(sender.path, 'mailbox');
        await initializeDurableInbox(senderContext, { name: 'sender', root: mailboxRoot });
        await initializeDurableInbox(receiverContext, { name: 'receiver', root: mailboxRoot });
        const packed = await packPacket(senderContext, sender.path, { title: 'Concurrent import' });
        const sent = await sendInboxPacket(senderContext, { packetPath: packed.archivePath, to: 'local:receiver' });
        const results = await Promise.all(
          Array.from({ length: 10 }, async () => await pullInboxDelivery(receiverContext, {
            deliveryId: sent.deliveryId,
            import: true,
          })),
        );
        const inboxEntries = await import('node:fs/promises').then(async ({ readdir }) => await readdir(receiverContext.paths.inbox));

        expect(results).toHaveLength(10);
        expect(new Set(results.map((result) => result.importedPacketId))).toEqual(new Set([packed.packetId]));
        expect(inboxEntries).toHaveLength(1);
      });
    });
  });

  it('rejects unknown recipients without silently creating a typo mailbox', async () => {
    await withTempProject({}, async (sender) => {
      await createBareStore(sender.path, { name: 'sender' });
      const context = await loadConfig({ cwd: sender.path });
      const mailboxRoot = path.join(sender.path, 'mailbox');
      await initializeDurableInbox(context, { name: 'sender', root: mailboxRoot });
      const packed = await packPacket(context, sender.path, { title: 'Unknown recipient' });

      await expect(sendInboxPacket(context, {
        packetPath: packed.archivePath,
        to: 'local:recevier',
      })).rejects.toMatchObject({ notchError: { code: 'NOTCH_INBOX_RECIPIENT_NOT_FOUND' } });
      await expect(readFile(path.join(mailboxRoot, 'recipients/recevier/deliveries'))).rejects.toBeDefined();
      expect(await readAuditLog(context.paths.logs)).toEqual(expect.arrayContaining([
        expect.objectContaining({ operation: 'inbox-send', result: 'failed', errorCode: 'NOTCH_INBOX_RECIPIENT_NOT_FOUND' }),
      ]));
    });
  });

  it('rejects a valid packet ID reused with different archive bytes', async () => {
    await withTempProject({}, async (sender) => {
      await withTempProject({}, async (receiver) => {
        await createBareStore(sender.path, { name: 'sender' });
        await createBareStore(receiver.path, { name: 'receiver' });
        const senderContext = await loadConfig({ cwd: sender.path });
        const receiverContext = await loadConfig({ cwd: receiver.path });
        const mailboxRoot = path.join(sender.path, 'mailbox');
        await initializeDurableInbox(senderContext, { name: 'sender', root: mailboxRoot });
        await initializeDurableInbox(receiverContext, { name: 'receiver', root: mailboxRoot });
        const packed = await packPacket(senderContext, sender.path, { title: 'Conflict packet' });
        await sendInboxPacket(senderContext, { packetPath: packed.archivePath, to: 'local:receiver' });
        const alteredPath = path.join(sender.path, 'altered.notchpkt');
        await writeFile(alteredPath, Buffer.concat([packed.archive, Buffer.from([0])]));

        await expect(sendInboxPacket(senderContext, {
          packetPath: alteredPath,
          to: 'local:receiver',
        })).rejects.toMatchObject({ notchError: { code: 'NOTCH_INBOX_DELIVERY_CONFLICT' } });
      });
    });
  });

  it('rejects secret-bearing and private packets before shared-mailbox write', async () => {
    await withTempProject({}, async (sender) => {
      await withTempProject({}, async (receiver) => {
        await createBareStore(sender.path, { name: 'sender' });
        await createBareStore(receiver.path, { name: 'receiver' });
        const senderContext = await loadConfig({ cwd: sender.path });
        const receiverContext = await loadConfig({ cwd: receiver.path });
        const mailboxRoot = path.join(sender.path, 'mailbox');
        await initializeDurableInbox(senderContext, { name: 'sender', root: mailboxRoot });
        await initializeDurableInbox(receiverContext, { name: 'receiver', root: mailboxRoot });

        const safe = await packPacket(senderContext, sender.path, { title: 'Content mutation' });
        const packetMarkdown = await readFile(safe.outboxPath, 'utf8');
        await writeFile(safe.outboxPath, `${packetMarkdown}\npassword should never enter the mailbox\n`, 'utf8');
        const secretArchive = await createPacketArchive({
          markdownPath: safe.outboxPath,
          rootPath: safe.outboxPath,
        });
        const secretPath = path.join(sender.path, 'secret.notchpkt');
        await writeFile(secretPath, secretArchive);

        await expect(sendInboxPacket(senderContext, {
          packetPath: secretPath,
          to: 'local:receiver',
        })).rejects.toMatchObject({ notchError: { code: 'NOTCH_SECRET_DETECTED' } });

        const privatePacket = await packPacket(senderContext, sender.path, {
          purpose: 'seed',
          sensitivity: 'private',
          title: 'Private seed',
        });
        await expect(sendInboxPacket(senderContext, {
          packetPath: privatePacket.archivePath,
          to: 'local:receiver',
        })).rejects.toMatchObject({ notchError: { code: 'NOTCH_INBOX_PRIVATE_PACKET_BLOCKED' } });
        expect((await listInboxDeliveries(receiverContext, { includeAll: true })).deliveries).toEqual([]);
      });
    });
  });

  it('enforces configured artifact limits and bounded archive decompression', async () => {
    await withTempProject({}, async (sender) => {
      await withTempProject({}, async (receiver) => {
        await createBareStore(sender.path, { name: 'sender' });
        await createBareStore(receiver.path, { name: 'receiver' });
        let senderContext = await loadConfig({ cwd: sender.path });
        const receiverContext = await loadConfig({ cwd: receiver.path });
        const mailboxRoot = path.join(sender.path, 'mailbox');
        await initializeDurableInbox(senderContext, { name: 'sender', root: mailboxRoot });
        await initializeDurableInbox(receiverContext, { name: 'receiver', root: mailboxRoot });
        await mkdir(path.join(sender.path, 'artifacts'));
        await writeFile(path.join(sender.path, 'artifacts/large.txt'), 'a'.repeat(100));
        const packed = await packPacket(senderContext, sender.path, {
          file: 'artifacts/large.txt',
          title: 'Oversized for configured receiver',
        });
        await setArtifactLimits(senderContext, { maxArtifactBytes: 50, maxPacketBytes: 1000 });
        senderContext = await loadConfig({ cwd: sender.path });

        await expect(sendInboxPacket(senderContext, {
          packetPath: packed.archivePath,
          to: 'local:receiver',
        })).rejects.toMatchObject({ notchError: { code: 'NOTCH_PACKET_TOO_LARGE' } });

        await setArtifactLimits(senderContext, { maxArtifactBytes: 1024, maxPacketBytes: 1024 });
        senderContext = await loadConfig({ cwd: sender.path });
        const oversizedPath = path.join(sender.path, 'oversized.notchpkt');
        await writeFile(oversizedPath, Buffer.alloc(9 * 1024 * 1024, 65));
        await expect(sendInboxPacket(senderContext, {
          packetPath: oversizedPath,
          to: 'local:receiver',
        })).rejects.toMatchObject({ notchError: { code: 'NOTCH_ARCHIVE_TOO_LARGE' } });

        const bombPath = path.join(sender.path, 'bomb.notchpkt');
        await writeFile(bombPath, gzipSync(Buffer.alloc(9 * 1024 * 1024, 65)));
        await expect(sendInboxPacket(senderContext, {
          packetPath: bombPath,
          to: 'local:receiver',
        })).rejects.toMatchObject({ notchError: { code: 'NOTCH_ARCHIVE_TOO_LARGE' } });
      });
    });
  });

  it('rejects corrupted delivery bytes before import and records rejected state and trace', async () => {
    await withTempProject({}, async (sender) => {
      await withTempProject({}, async (receiver) => {
        await createBareStore(sender.path, { name: 'sender' });
        await createBareStore(receiver.path, { name: 'receiver' });
        const senderContext = await loadConfig({ cwd: sender.path });
        const receiverContext = await loadConfig({ cwd: receiver.path });
        const mailboxRoot = path.join(sender.path, 'mailbox');
        await initializeDurableInbox(senderContext, { name: 'sender', root: mailboxRoot });
        await initializeDurableInbox(receiverContext, { name: 'receiver', root: mailboxRoot });
        const packed = await packPacket(senderContext, sender.path, { title: 'Corruption test' });
        const sent = await sendInboxPacket(senderContext, { packetPath: packed.archivePath, to: 'local:receiver' });
        await writeFile(sent.packetPath, 'corrupted');

        await expect(pullInboxDelivery(receiverContext, {
          deliveryId: sent.deliveryId,
          import: true,
        })).rejects.toMatchObject({ notchError: { code: 'NOTCH_INBOX_HASH_MISMATCH' } });
        expect(await listInboxDeliveries(receiverContext, { includeAll: true })).toMatchObject({
          deliveries: [expect.objectContaining({ state: 'rejected', errorCode: 'NOTCH_INBOX_HASH_MISMATCH' })],
        });
        expect(await readAuditLog(receiverContext.paths.logs)).toEqual(expect.arrayContaining([
          expect.objectContaining({
            operation: 'inbox-reject',
            result: 'blocked',
            errorCode: 'NOTCH_INBOX_HASH_MISMATCH',
          }),
        ]));
        expect(await import('node:fs/promises').then(async ({ readdir }) => await readdir(receiverContext.paths.inbox))).toEqual([]);
      });
    });
  });

  it.skipIf(process.platform === 'win32')('rejects symlinked outgoing archives', async () => {
    await withTempProject({}, async (sender) => {
      await withTempProject({}, async (receiver) => {
        await createBareStore(sender.path, { name: 'sender' });
        await createBareStore(receiver.path, { name: 'receiver' });
        const senderContext = await loadConfig({ cwd: sender.path });
        const receiverContext = await loadConfig({ cwd: receiver.path });
        const mailboxRoot = path.join(sender.path, 'mailbox');
        await initializeDurableInbox(senderContext, { name: 'sender', root: mailboxRoot });
        await initializeDurableInbox(receiverContext, { name: 'receiver', root: mailboxRoot });
        const packed = await packPacket(senderContext, sender.path, { title: 'Symlink test' });
        const linkPath = path.join(sender.path, 'packet-link.notchpkt');
        await symlink(packed.archivePath, linkPath);

        await expect(sendInboxPacket(senderContext, {
          packetPath: linkPath,
          to: 'local:receiver',
        })).rejects.toMatchObject({ notchError: { code: 'NOTCH_SYMLINK_REJECTED' } });
      });
    });
  });
});

async function packPacket(
  context: Awaited<ReturnType<typeof loadConfig>>,
  projectPath: string,
  input: {
    file?: string;
    purpose?: PacketPurpose;
    sensitivity?: Sensitivity;
    title: string;
  },
): Promise<{ archive: Buffer; archivePath: string; outboxPath: string; packetId: string }> {
  const created = await createPacket(context, {
    files: input.file ? [{ path: input.file, purpose: 'source' }] : [],
    ...(input.purpose ? { purpose: input.purpose } : {}),
    ...(input.sensitivity ? { sensitivity: input.sensitivity } : {}),
    summary: `${input.title} summary.`,
    title: input.title,
    toAgent: 'receiver',
  });
  const archive = await createPacketArchive({
    markdownPath: created.outboxPath,
    rootPath: created.outboxPath.endsWith('packet.md') ? path.dirname(created.outboxPath) : created.outboxPath,
  });
  const archivePath = path.join(projectPath, `${created.packet.id}.notchpkt`);
  await writeFile(archivePath, archive);
  return { archive, archivePath, outboxPath: created.outboxPath, packetId: created.packet.id };
}

async function setArtifactLimits(
  context: Awaited<ReturnType<typeof loadConfig>>,
  artifacts: { maxArtifactBytes: number; maxPacketBytes: number },
): Promise<void> {
  const config = JSON.parse(await readFile(context.paths.config, 'utf8')) as NotchConfig;
  await writeFile(context.paths.config, `${JSON.stringify({ ...config, artifacts }, null, 2)}\n`, 'utf8');
}
