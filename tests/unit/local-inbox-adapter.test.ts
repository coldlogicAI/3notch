import { readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { sha256 } from '../../src/core/artifact-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import {
  deliveryIdForPacketId,
  initializeInboxConfig,
  loadInboxConfig,
  LocalInboxAdapter,
  localInboxAddress,
  normalizeInboxName,
  parseLocalInboxAddress,
} from '../../src/core/local-inbox-adapter.js';
import type { InboxDelivery } from '../../src/types/inbox.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('local durable inbox adapter', () => {
  it('normalizes safe local addresses and rejects path-shaped addresses', () => {
    expect(normalizeInboxName('Review Agent')).toBe('review-agent');
    expect(localInboxAddress('Review Agent')).toBe('local:review-agent');
    expect(parseLocalInboxAddress('local:review-agent')).toBe('review-agent');
    expect(deliveryIdForPacketId('packet_example')).toMatch(/^delivery_[a-f0-9]{24}$/u);

    for (const unsafe of ['review-agent', 'local:../review-agent', 'local:/tmp', 'local:review\\agent', 'local:.']) {
      expect(() => parseLocalInboxAddress(unsafe)).toThrowError(expect.objectContaining({
        notchError: expect.objectContaining({ code: 'NOTCH_INBOX_ADDRESS_INVALID' }),
      }));
    }
  });

  it('creates ignored machine-local config idempotently and refuses silent reconfiguration', async () => {
    await withTempProject({}, async (project) => {
      const storePath = await createBareStore(project.path, { name: 'receiver' });
      const context = await loadConfig({ cwd: project.path });
      const mailboxRoot = path.join(project.path, 'mailbox');
      const first = await initializeInboxConfig(context, { name: 'Review Agent', root: mailboxRoot });
      const second = await initializeInboxConfig(context, { name: 'Review Agent', root: mailboxRoot });

      expect(first.alreadyInitialized).toBe(false);
      expect(second.alreadyInitialized).toBe(true);
      expect(await loadInboxConfig(context)).toMatchObject({
        address: 'local:review-agent',
        root: mailboxRoot,
      });
      expect(await readFile(path.join(storePath, '.gitignore'), 'utf8')).toContain('inbox-config.json');
      await expect(initializeInboxConfig(context, {
        name: 'other-agent',
        root: mailboxRoot,
      })).rejects.toMatchObject({ notchError: { code: 'NOTCH_INBOX_ALREADY_CONFIGURED' } });
    });
  });

  it('stores one atomic delivery, deduplicates identical retries, and rejects conflicting bytes', async () => {
    await withTempProject({}, async (project) => {
      const root = path.join(project.path, 'mailbox');
      const adapter = new LocalInboxAdapter(root);
      await adapter.initializeRecipient('local:receiver');
      const packet = Buffer.from('packet-one');
      const delivery = fixtureDelivery(packet);
      const first = await adapter.putDelivery('local:receiver', { delivery, packet });
      const retry = await adapter.putDelivery('local:receiver', { delivery, packet });
      const conflictingPacket = Buffer.from('packet-two');
      const conflict = {
        ...delivery,
        packetHash: sha256(conflictingPacket),
        bytes: conflictingPacket.byteLength,
      } satisfies InboxDelivery;

      expect(first.idempotent).toBe(false);
      expect(retry.idempotent).toBe(true);
      expect(retry.packetPath).toBe(first.packetPath);
      await expect(adapter.putDelivery('local:receiver', {
        delivery: conflict,
        packet: conflictingPacket,
      })).rejects.toMatchObject({ notchError: { code: 'NOTCH_INBOX_DELIVERY_CONFLICT' } });
      await expect(adapter.putDelivery('local:receiver', {
        delivery: { ...delivery, to: 'local:other' },
        packet,
      })).rejects.toMatchObject({ notchError: { code: 'NOTCH_INBOX_DELIVERY_CONFLICT' } });
      await expect(adapter.putDelivery('local:receiver', {
        delivery: { ...delivery, deliveryId: 'delivery_000000000000000000000000' },
        packet,
      })).rejects.toMatchObject({ notchError: { code: 'NOTCH_INBOX_DELIVERY_INVALID' } });

      const entries = await readdir(path.dirname(first.packetPath));
      expect(entries.sort()).toEqual(['delivery.json', 'packet.notchpkt', 'packet.sha256']);
      expect(entries.some((entry) => entry.startsWith('.'))).toBe(false);
    });
  });

  it('serializes simultaneous identical sends into one delivery without temp remnants', async () => {
    await withTempProject({}, async (project) => {
      const root = path.join(project.path, 'mailbox');
      const adapter = new LocalInboxAdapter(root);
      await adapter.initializeRecipient('local:receiver');
      const packet = Buffer.from('same retry bytes');
      const delivery = fixtureDelivery(packet);
      const results = await Promise.all(
        Array.from({ length: 20 }, async () => await adapter.putDelivery('local:receiver', { delivery, packet })),
      );
      const deliveriesPath = path.join(root, 'recipients/receiver/deliveries');

      expect(results.filter((result) => !result.idempotent)).toHaveLength(1);
      expect(results.filter((result) => result.idempotent)).toHaveLength(19);
      expect(await readdir(deliveriesPath)).toEqual([delivery.deliveryId]);
    });
  });

  it('lists pending by default, retains acknowledged history, and keeps packet bytes', async () => {
    await withTempProject({}, async (project) => {
      const root = path.join(project.path, 'mailbox');
      const adapter = new LocalInboxAdapter(root);
      await adapter.initializeRecipient('local:receiver');
      const packet = Buffer.from('retained packet');
      const delivery = fixtureDelivery(packet);
      await adapter.putDelivery('local:receiver', { delivery, packet });

      expect(await adapter.listDeliveries('local:receiver')).toHaveLength(1);
      await adapter.withDelivery('local:receiver', delivery.deliveryId, { maxBytes: 1024 }, async (locked) => {
        await locked.update({ state: 'acked', ackedAt: new Date().toISOString() });
      });

      expect(await adapter.listDeliveries('local:receiver')).toEqual([]);
      expect(await adapter.listDeliveries('local:receiver', { includeAll: true })).toEqual([
        expect.objectContaining({ deliveryId: delivery.deliveryId, state: 'acked' }),
      ]);
      expect(await readFile(path.join(root, `recipients/receiver/deliveries/${delivery.deliveryId}/packet.notchpkt`))).toEqual(packet);
    });
  });

  it('fails closed and marks a delivery rejected when packet bytes no longer match the hash', async () => {
    await withTempProject({}, async (project) => {
      const root = path.join(project.path, 'mailbox');
      const adapter = new LocalInboxAdapter(root);
      await adapter.initializeRecipient('local:receiver');
      const packet = Buffer.from('original packet');
      const delivery = fixtureDelivery(packet);
      const stored = await adapter.putDelivery('local:receiver', { delivery, packet });
      await writeFile(stored.packetPath, 'tampered packet');

      await expect(adapter.withDelivery(
        'local:receiver',
        delivery.deliveryId,
        { maxBytes: 1024 },
        async () => undefined,
      )).rejects.toMatchObject({ notchError: { code: 'NOTCH_INBOX_HASH_MISMATCH' } });
      expect(await adapter.listDeliveries('local:receiver', { includeAll: true })).toEqual([
        expect.objectContaining({
          deliveryId: delivery.deliveryId,
          state: 'rejected',
          errorCode: 'NOTCH_INBOX_HASH_MISMATCH',
        }),
      ]);
    });
  });

  it.skipIf(process.platform === 'win32')('rejects symlinked recipient and delivery paths', async () => {
    await withTempProject({}, async (project) => {
      const root = path.join(project.path, 'mailbox');
      const adapter = new LocalInboxAdapter(root);
      await adapter.initializeRecipient('local:receiver');
      const outside = path.join(project.path, 'outside');
      await new LocalInboxAdapter(outside).initializeRecipient('local:unused');
      await symlink(
        path.join(outside, 'recipients'),
        path.join(root, 'recipients/linked'),
      );

      await expect(adapter.listDeliveries('local:linked')).rejects.toMatchObject({
        notchError: { code: 'NOTCH_SYMLINK_REJECTED' },
      });
    });
  });

  it('rejects malformed metadata and unexpected delivery-store entries', async () => {
    await withTempProject({}, async (project) => {
      const root = path.join(project.path, 'mailbox');
      const adapter = new LocalInboxAdapter(root);
      await adapter.initializeRecipient('local:receiver');
      const deliveriesPath = path.join(root, 'recipients/receiver/deliveries');
      await writeFile(path.join(deliveriesPath, 'unexpected.txt'), 'not a delivery');

      await expect(adapter.listDeliveries('local:receiver')).rejects.toMatchObject({
        notchError: { code: 'NOTCH_INBOX_DELIVERY_INVALID' },
      });
    });
  });

  it('rejects delivery metadata with an impossible lifecycle state', async () => {
    await withTempProject({}, async (project) => {
      const root = path.join(project.path, 'mailbox');
      const adapter = new LocalInboxAdapter(root);
      await adapter.initializeRecipient('local:receiver');
      const packet = Buffer.from('lifecycle packet');
      const delivery = fixtureDelivery(packet);
      const stored = await adapter.putDelivery('local:receiver', { delivery, packet });
      const metadataPath = path.join(path.dirname(stored.packetPath), 'delivery.json');
      await writeFile(metadataPath, `${JSON.stringify({ ...delivery, state: 'acked' }, null, 2)}\n`);

      await expect(adapter.listDeliveries('local:receiver', { includeAll: true })).rejects.toMatchObject({
        notchError: { code: 'NOTCH_INBOX_DELIVERY_INVALID' },
      });
    });
  });
});

function fixtureDelivery(packet: Buffer): InboxDelivery {
  const packetId = 'packet_adapter_fixture';
  const now = new Date().toISOString();

  return {
    schemaVersion: '1.0.0',
    deliveryId: deliveryIdForPacketId(packetId),
    transport: 'local',
    from: 'local:sender',
    to: 'local:receiver',
    packetId,
    packetHash: sha256(packet),
    bytes: packet.byteLength,
    state: 'pending',
    createdAt: now,
    updatedAt: now,
  };
}
