import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  DEFAULT_MAX_ARCHIVE_BYTES,
  DEFAULT_MAX_UNPACKED_ARCHIVE_BYTES,
  unpackPacketArchiveToTemp,
} from './archive-service.js';
import {
  DEFAULT_MAX_ARTIFACT_BYTES,
  DEFAULT_MAX_PACKET_BYTES,
  sha256,
  verifyPacketFolderArtifacts,
} from './artifact-service.js';
import { appendAuditEntry } from './audit-service.js';
import { resolveActor } from './actor-service.js';
import {
  deliveryIdForPacketId,
  initializeInboxConfig,
  loadInboxConfig,
  LocalInboxAdapter,
  parseLocalInboxAddress,
} from './local-inbox-adapter.js';
import { parseAndValidateRecord } from './record-parser.js';
import {
  assertNoSecretsInArtifactWithAudit,
  assertNoSecretsWithAudit,
} from './secret-scan-service.js';
import { importPacketFolder } from './transfer-service.js';
import { errorToNotchError, NotchException } from '../types/errors.js';
import type { LoadedConfig } from './config-service.js';
import type { InboxConfig, InboxDelivery, InboxDeliveryStatusResult, InboxResult } from '../types/inbox.js';
import type { NotchPacket, SourceTool } from '../types/records.js';

const archiveOverheadBytes = 8 * 1024 * 1024;

export type InboxActorOptions = {
  actor?: string;
  agent?: string;
  mcp?: boolean;
  sourceTool?: SourceTool['name'];
};

export type InboxInitResult = {
  ok: true;
  address: string;
  root: string;
  transport: 'local';
  alreadyInitialized: boolean;
  nextAction: string;
};

export type InboxListResult = {
  ok: true;
  address: string;
  deliveries: InboxDelivery[];
  nextAction: string;
};

export type InboxSendResult = InboxResult & {
  idempotent: boolean;
  notice: string;
};

export async function initializeDurableInbox(
  context: LoadedConfig,
  input: { name: string; root: string },
  options: InboxActorOptions = {},
): Promise<InboxInitResult> {
  const author = inboxActor(context, options);

  try {
    const initialized = await initializeInboxConfig(context, input);
    await appendAuditEntry(context.paths.logs, {
      schemaVersion: '1.0.0',
      at: new Date().toISOString(),
      operation: 'inbox-init',
      result: 'success',
      actor: author.actor,
      actorNameResolution: author.actorNameResolution,
      actorTypeResolution: author.actorTypeResolution,
      sourceTool: author.sourceTool,
      to: initialized.config.address,
    });

    return {
      ok: true,
      address: initialized.config.address,
      root: initialized.config.root,
      transport: 'local',
      alreadyInitialized: initialized.alreadyInitialized,
      nextAction: `Share ${initialized.config.address} with a sender configured on the same mailbox root.`,
    };
  } catch (error) {
    await auditFailure(context, author, 'inbox-init', error);
    throw error;
  }
}

export async function sendInboxPacket(
  context: LoadedConfig,
  input: { packetPath: string; to: string },
  options: InboxActorOptions = {},
): Promise<InboxSendResult> {
  const author = inboxActor(context, options);
  let config: InboxConfig | undefined;
  let inspected: InspectedPacket | undefined;

  try {
    config = await loadInboxConfig(context);
    parseLocalInboxAddress(input.to);
    inspected = await inspectPacketArchive(context, input.packetPath, author);
    const deliveryId = deliveryIdForPacketId(inspected.packet.id);
    const now = new Date().toISOString();
    const delivery: InboxDelivery = {
      schemaVersion: '1.0.0',
      deliveryId,
      transport: 'local',
      from: config.address,
      to: input.to,
      packetId: inspected.packet.id,
      packetHash: inspected.packetHash,
      bytes: inspected.bytes,
      state: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    const stored = await new LocalInboxAdapter(config.root).putDelivery(input.to, {
      delivery,
      packet: inspected.archive,
    });

    await appendAuditEntry(context.paths.logs, {
      schemaVersion: '1.0.0',
      at: new Date().toISOString(),
      operation: 'inbox-send',
      result: 'success',
      actor: author.actor,
      actorNameResolution: author.actorNameResolution,
      actorTypeResolution: author.actorTypeResolution,
      sourceTool: author.sourceTool,
      recordType: 'packet',
      recordId: stored.delivery.packetId,
      deliveryId: stored.delivery.deliveryId,
      deliveryState: stored.delivery.state,
      packetHash: stored.delivery.packetHash,
      from: stored.delivery.from,
      to: stored.delivery.to,
      bytes: stored.delivery.bytes,
      ...(stored.idempotent ? { reason: 'idempotent-retry' } : {}),
    });

    const notice = deliveryNotice(stored.delivery);

    return {
      ok: true,
      deliveryId: stored.delivery.deliveryId,
      packetId: stored.delivery.packetId,
      packetHash: stored.delivery.packetHash,
      state: stored.delivery.state,
      packetPath: stored.packetPath,
      idempotent: stored.idempotent,
      notice,
      nextAction: `Send the delivery notice to ${stored.delivery.to}; status can be checked with notch inbox status ${stored.delivery.deliveryId} --at ${stored.delivery.to}.`,
    };
  } catch (error) {
    await auditFailure(context, author, 'inbox-send', error, {
      ...(config ? { from: config.address } : {}),
      to: input.to,
      ...(inspected ? {
        recordId: inspected.packet.id,
        packetHash: inspected.packetHash,
        bytes: inspected.bytes,
      } : {}),
    });
    throw error;
  }
}

export async function listInboxDeliveries(
  context: LoadedConfig,
  input: { includeAll?: boolean } = {},
): Promise<InboxListResult> {
  const config = await loadInboxConfig(context);
  const deliveries = await new LocalInboxAdapter(config.root).listDeliveries(config.address, input);

  return {
    ok: true,
    address: config.address,
    deliveries,
    nextAction: deliveries.length > 0
      ? `Pull a delivery with notch inbox pull ${deliveries[0]?.deliveryId ?? '<delivery-id>'} --import.`
      : 'No matching deliveries. Wait for a sender or run with --all to include processed deliveries.',
  };
}

export async function getInboxDeliveryStatus(
  context: LoadedConfig,
  input: { deliveryId: string; address?: string },
): Promise<InboxDeliveryStatusResult> {
  const config = await loadInboxConfig(context);
  const address = input.address ?? config.address;
  parseLocalInboxAddress(address);
  const result = await new LocalInboxAdapter(config.root).getDelivery(address, input.deliveryId);

  return {
    ...inboxResult(result.delivery, result.packetPath, deliveryStatusNextAction(result.delivery)),
    address,
    delivery: result.delivery,
  };
}

export async function pullInboxDelivery(
  context: LoadedConfig,
  input: { deliveryId: string; import?: boolean; asReviewed?: boolean },
  options: InboxActorOptions = {},
): Promise<InboxResult> {
  const author = inboxActor(context, options);
  const config = await loadInboxConfig(context);
  const limits = archiveLimits(context);

  try {
    const result = await new LocalInboxAdapter(config.root).withDelivery(
      config.address,
      input.deliveryId,
      { maxBytes: limits.maxArchiveBytes },
      async (locked) => {
        const recoveringPolicyRejection = locked.delivery.state === 'rejected'
          && isRetryableDeliveryError(locked.delivery.errorCode);

        if (locked.delivery.state === 'rejected' && !recoveringPolicyRejection) {
          throw invalidState(locked.delivery, 'Rejected deliveries cannot be pulled.');
        }

        if (locked.delivery.state === 'acked' && !locked.delivery.importedPacketId) {
          throw invalidState(locked.delivery, 'This delivery was acknowledged without import.');
        }

        let inspected: InspectedPacket;

        try {
          inspected = await inspectPacketArchiveBytes(
            context,
            locked.packet,
            path.basename(locked.packetPath),
            author,
            locked.delivery.packetId,
          );
        } catch (error) {
          const notchError = errorToNotchError(error);

          if (isTerminalDeliveryError(notchError.code)) {
            const now = new Date().toISOString();
            await locked.update({
              state: 'rejected',
              rejectedAt: now,
              errorCode: notchError.code,
            });
          }

          throw error;
        }

        if (inspected.packetHash !== locked.delivery.packetHash) {
          throw new NotchException({
            code: 'NOTCH_INBOX_HASH_MISMATCH',
            message: 'Validated archive hash does not match delivery metadata.',
            recovery: 'Do not import this delivery. Ask the sender to retry from the original packet.',
            severity: 'error',
            exitCode: 5,
          });
        }

        if (input.import && !locked.delivery.importedPacketId) {
          const unpacked = await unpackPacketArchiveToTemp(locked.packet, limits);

          try {
            const imported = await importPacketFolder(context, unpacked.packetFolderPath, {
              ...(options.actor ? { actor: options.actor } : {}),
              ...(options.agent ? { agent: options.agent } : {}),
              ...(input.asReviewed ? { asReviewed: true } : {}),
              ...(options.mcp ? { mcp: true } : {}),
              sourceTool: options.sourceTool ?? (options.mcp ? 'notch-mcp' : 'notch-cli'),
            });
            const now = new Date().toISOString();
            const updated = await locked.update({
              state: locked.delivery.state === 'acked' ? 'acked' : 'pulled',
              pulledAt: locked.delivery.pulledAt ?? now,
              importedAt: now,
              importedPacketId: imported.packet.id,
              ...(recoveringPolicyRejection ? { clearRejection: true } : {}),
            });

            return inboxResult(updated, locked.packetPath, 'Acknowledge the imported delivery after reviewing the packet.');
          } finally {
            await unpacked.cleanup();
          }
        }

        const now = new Date().toISOString();
        const updated = locked.delivery.state === 'pending'
          || recoveringPolicyRejection
          ? await locked.update({
              state: 'pulled',
              pulledAt: locked.delivery.pulledAt ?? now,
              ...(recoveringPolicyRejection ? { clearRejection: true } : {}),
            })
          : locked.delivery;

        return inboxResult(
          updated,
          locked.packetPath,
          updated.importedPacketId
            ? 'This delivery is already imported. Acknowledge it after review.'
            : `Inspect ${locked.packetPath}, then pull again with --import or acknowledge it as intentionally skipped.`,
        );
      },
    );

    await appendAuditEntry(context.paths.logs, {
      schemaVersion: '1.0.0',
      at: new Date().toISOString(),
      operation: 'inbox-pull',
      result: 'success',
      actor: author.actor,
      actorNameResolution: author.actorNameResolution,
      actorTypeResolution: author.actorTypeResolution,
      sourceTool: author.sourceTool,
      recordType: 'packet',
      recordId: result.packetId,
      deliveryId: result.deliveryId,
      deliveryState: result.state,
      packetHash: result.packetHash,
      to: config.address,
      ...(result.importedPacketId ? { reason: 'imported', importedFrom: result.deliveryId } : { reason: 'verified-only' }),
    });

    return result;
  } catch (error) {
    const notchError = errorToNotchError(error);
    const rejected = isTerminalDeliveryError(notchError.code);
    await auditFailure(context, author, rejected ? 'inbox-reject' : 'inbox-pull', error, {
      deliveryId: input.deliveryId,
      ...(rejected ? { deliveryState: 'rejected' as const } : {}),
      to: config.address,
    });
    throw error;
  }
}

export async function ackInboxDelivery(
  context: LoadedConfig,
  input: { deliveryId: string },
  options: InboxActorOptions = {},
): Promise<InboxResult> {
  const author = inboxActor(context, options);
  const config = await loadInboxConfig(context);
  const limits = archiveLimits(context);

  try {
    const result = await new LocalInboxAdapter(config.root).withDelivery(
      config.address,
      input.deliveryId,
      { maxBytes: limits.maxArchiveBytes },
      async (locked) => {
        if (locked.delivery.state === 'rejected') {
          throw invalidState(locked.delivery, 'Rejected deliveries cannot be acknowledged.');
        }

        const updated = locked.delivery.state === 'acked'
          ? locked.delivery
          : await locked.update({ state: 'acked', ackedAt: new Date().toISOString() });
        return inboxResult(updated, locked.packetPath, 'Delivery retained for audit; no further action is required.');
      },
    );

    await appendAuditEntry(context.paths.logs, {
      schemaVersion: '1.0.0',
      at: new Date().toISOString(),
      operation: 'inbox-ack',
      result: 'success',
      actor: author.actor,
      actorNameResolution: author.actorNameResolution,
      actorTypeResolution: author.actorTypeResolution,
      sourceTool: author.sourceTool,
      recordType: 'packet',
      recordId: result.packetId,
      deliveryId: result.deliveryId,
      deliveryState: result.state,
      packetHash: result.packetHash,
      to: config.address,
    });

    return result;
  } catch (error) {
    await auditFailure(context, author, 'inbox-ack', error, {
      deliveryId: input.deliveryId,
      to: config.address,
    });
    throw error;
  }
}

type InboxActor = ReturnType<typeof resolveActor>;

type InspectedPacket = {
  archive: Buffer;
  bytes: number;
  packet: NotchPacket;
  packetHash: string;
};

function inboxActor(context: LoadedConfig, options: InboxActorOptions): InboxActor {
  return resolveActor({
    ...(options.actor ? { actor: options.actor } : {}),
    ...(options.agent ? { agent: options.agent } : {}),
    cwd: context.projectRoot,
    ...(options.mcp ? { mcp: true } : {}),
    sourceTool: options.sourceTool ?? (options.mcp ? 'notch-mcp' : 'notch-cli'),
  });
}

async function inspectPacketArchive(
  context: LoadedConfig,
  packetPath: string,
  author: InboxActor,
): Promise<InspectedPacket> {
  const absolutePath = path.isAbsolute(packetPath)
    ? packetPath
    : path.resolve(context.projectRoot, packetPath);
  const packetStat = await lstat(absolutePath);

  if (packetStat.isSymbolicLink()) {
    throw new NotchException({
      code: 'NOTCH_SYMLINK_REJECTED',
      message: `Durable inbox does not send symlinked packet files: ${packetPath}`,
      path: packetPath,
      recovery: 'Pass the real .notchpkt file created by notch packet pack.',
      severity: 'error',
      exitCode: 5,
    });
  }

  if (!packetStat.isFile() || path.extname(absolutePath) !== '.notchpkt') {
    throw new NotchException({
      code: 'NOTCH_INBOX_PACKET_INVALID',
      message: 'Durable inbox sends regular .notchpkt files only.',
      path: packetPath,
      recovery: 'Run notch packet pack <packet-id>, then send the resulting .notchpkt file.',
      severity: 'error',
      exitCode: 1,
    });
  }

  const limits = archiveLimits(context);

  if (packetStat.size > limits.maxArchiveBytes) {
    throw new NotchException({
      code: 'NOTCH_ARCHIVE_TOO_LARGE',
      message: `Inbox archive exceeds the configured packet limit (${packetStat.size} > ${limits.maxArchiveBytes}).`,
      path: packetPath,
      recovery: 'Create a smaller packet or raise the limit only after reviewing the source.',
      severity: 'error',
      exitCode: 5,
    });
  }

  const archive = await readFile(absolutePath);
  return await inspectPacketArchiveBytes(context, archive, path.basename(absolutePath), author);
}

async function inspectPacketArchiveBytes(
  context: LoadedConfig,
  archive: Buffer,
  sourceName: string,
  author: InboxActor,
  expectedPacketId?: string,
): Promise<InspectedPacket> {
  const limits = archiveLimits(context);
  const unpacked = await unpackPacketArchiveToTemp(archive, limits);

  try {
    const markdownPath = path.join(unpacked.packetFolderPath, 'packet.md');
    const markdown = await readFile(markdownPath, 'utf8');
    const parsed = parseAndValidateRecord<NotchPacket>(markdown, sourceName);

    if (!parsed.ok) {
      const first = parsed.errors[0];
      throw new NotchException({
        code: first?.code ?? 'NOTCH_RECORD_INVALID',
        message: first?.message ?? 'Inbox packet is invalid.',
        path: sourceName,
        recovery: 'Recreate the packet with the current 3Notch CLI.',
        severity: 'error',
        exitCode: 3,
      });
    }

    const packet = parsed.data;

    if (expectedPacketId && packet.id !== expectedPacketId) {
      throw new NotchException({
        code: 'NOTCH_INBOX_DELIVERY_CONFLICT',
        message: `Delivery metadata names ${expectedPacketId}, but the archive contains ${packet.id}.`,
        recovery: 'Reject this delivery and ask the sender to retry from the original archive.',
        severity: 'error',
        exitCode: 5,
      });
    }

    if (packet.purpose === 'seed' || packet.sensitivity === 'private') {
      throw new NotchException({
        code: 'NOTCH_INBOX_PRIVATE_PACKET_BLOCKED',
        message: 'Durable inbox V1 does not place private or seed packets in a shared mailbox.',
        recovery: 'Use an ordinary project handoff packet, or transfer private packets through an explicitly trusted channel.',
        severity: 'error',
        exitCode: 5,
      });
    }

    await verifyPacketFolderArtifacts(unpacked.packetFolderPath, packet);
    assertPacketArtifactLimits(context, packet);
    await assertNoSecretsWithAudit(markdown, context.config, {
      actor: author.actor,
      actorNameResolution: author.actorNameResolution,
      actorTypeResolution: author.actorTypeResolution,
      field: 'durable inbox packet markdown',
      logsDir: context.paths.logs,
      path: sourceName,
      recordId: packet.id,
      recordType: 'packet',
      sourceTool: author.sourceTool,
    });

    for (const artifact of packet.artifacts ?? []) {
      await assertNoSecretsInArtifactWithAudit(
        await readFile(path.join(unpacked.packetFolderPath, artifact.path)),
        context.config,
        {
          actor: author.actor,
          actorNameResolution: author.actorNameResolution,
          actorTypeResolution: author.actorTypeResolution,
          logsDir: context.paths.logs,
          path: artifact.path,
          recordId: packet.id,
          recordType: 'packet',
          sourcePath: artifact.path,
          sourceTool: author.sourceTool,
        },
      );
    }

    return {
      archive,
      bytes: archive.byteLength,
      packet,
      packetHash: sha256(archive),
    };
  } finally {
    await unpacked.cleanup();
  }
}

function assertPacketArtifactLimits(context: LoadedConfig, packet: NotchPacket): void {
  const maxArtifactBytes = context.config.artifacts?.maxArtifactBytes ?? DEFAULT_MAX_ARTIFACT_BYTES;
  const maxPacketBytes = context.config.artifacts?.maxPacketBytes ?? DEFAULT_MAX_PACKET_BYTES;
  let total = 0;

  for (const artifact of packet.artifacts ?? []) {
    if (artifact.bytes >= maxArtifactBytes) {
      throw packetTooLarge(artifact.bytes, maxArtifactBytes, artifact.path);
    }

    total += artifact.bytes;
  }

  if (total >= maxPacketBytes) {
    throw packetTooLarge(total, maxPacketBytes, packet.id);
  }
}

function archiveLimits(context: LoadedConfig): {
  maxArchiveBytes: number;
  maxEntries: number;
  maxUnpackedBytes: number;
} {
  const packetLimit = context.config.artifacts?.maxPacketBytes ?? DEFAULT_MAX_PACKET_BYTES;
  return {
    maxArchiveBytes: Math.min(DEFAULT_MAX_ARCHIVE_BYTES, packetLimit + archiveOverheadBytes),
    maxEntries: 4_096,
    maxUnpackedBytes: Math.min(DEFAULT_MAX_UNPACKED_ARCHIVE_BYTES, packetLimit + archiveOverheadBytes),
  };
}

function packetTooLarge(actual: number, maximum: number, packetPath: string): NotchException {
  return new NotchException({
    code: 'NOTCH_PACKET_TOO_LARGE',
    message: `Inbox packet exceeds its configured size limit (${actual} >= ${maximum}).`,
    path: packetPath,
    recovery: 'Create a smaller packet or raise the limit only after reviewing the files.',
    severity: 'error',
    exitCode: 5,
  });
}

function invalidState(delivery: InboxDelivery, message: string): NotchException {
  return new NotchException({
    code: 'NOTCH_INBOX_STATE_INVALID',
    message,
    path: delivery.deliveryId,
    recovery: 'Run notch inbox list --all to inspect the delivery state.',
    severity: 'error',
    exitCode: 6,
  });
}

function inboxResult(delivery: InboxDelivery, packetPath: string, nextAction: string): InboxResult {
  return {
    ok: true,
    deliveryId: delivery.deliveryId,
    packetId: delivery.packetId,
    packetHash: delivery.packetHash,
    state: delivery.state,
    packetPath,
    ...(delivery.importedPacketId ? { importedPacketId: delivery.importedPacketId } : {}),
    nextAction,
  };
}

function deliveryNotice(delivery: InboxDelivery): string {
  return [
    '3Notch delivery notice',
    `from: ${delivery.from}`,
    `to: ${delivery.to}`,
    `delivery_id: ${delivery.deliveryId}`,
    `packet_id: ${delivery.packetId}`,
    `sha256: ${delivery.packetHash}`,
    `receiver_action: run \`notch inbox pull ${delivery.deliveryId} --import\`, review the packet, then run \`notch inbox ack ${delivery.deliveryId}\``,
    `sender_status: run \`notch inbox status ${delivery.deliveryId} --at ${delivery.to}\``,
  ].join('\n');
}

function deliveryStatusNextAction(delivery: InboxDelivery): string {
  if (delivery.state === 'pending') {
    return `${delivery.to} has not pulled this delivery yet. Receiver should run notch inbox pull ${delivery.deliveryId} --import, review it, then run notch inbox ack ${delivery.deliveryId}.`;
  }

  if (delivery.state === 'pulled') {
    return delivery.importedPacketId
      ? `${delivery.to} imported ${delivery.importedPacketId}; wait for review or ask the receiver to acknowledge ${delivery.deliveryId}.`
      : `${delivery.to} verified the archive but has not imported it; receiver should import or acknowledge the delivery intentionally.`;
  }

  if (delivery.state === 'acked') {
    return `${delivery.to} acknowledged the delivery. Packet bytes remain retained for audit.`;
  }

  return `${delivery.to} rejected the delivery${delivery.errorCode ? ` with ${delivery.errorCode}` : ''}. Send a corrected packet with a new packet ID.`;
}

async function auditFailure(
  context: LoadedConfig,
  author: InboxActor,
  operation: 'inbox-ack' | 'inbox-init' | 'inbox-pull' | 'inbox-reject' | 'inbox-send',
  error: unknown,
  fields: {
    recordId?: string;
    deliveryId?: string;
    deliveryState?: InboxDelivery['state'];
    packetHash?: string;
    from?: string;
    to?: string;
    bytes?: number;
  } = {},
): Promise<void> {
  const notchError = errorToNotchError(error);
  await appendAuditEntry(context.paths.logs, {
    schemaVersion: '1.0.0',
    at: new Date().toISOString(),
    operation,
    result: operation === 'inbox-reject' ? 'blocked' : 'failed',
    actor: author.actor,
    actorNameResolution: author.actorNameResolution,
    actorTypeResolution: author.actorTypeResolution,
    sourceTool: author.sourceTool,
    ...(fields.recordId ? { recordType: 'packet', recordId: fields.recordId } : {}),
    ...(fields.deliveryId && /^delivery_[a-f0-9]{24}$/u.test(fields.deliveryId) ? { deliveryId: fields.deliveryId } : {}),
    ...(fields.deliveryState ? { deliveryState: fields.deliveryState } : {}),
    ...(fields.packetHash ? { packetHash: fields.packetHash } : {}),
    ...(validLocalAddress(fields.from) ? { from: fields.from } : {}),
    ...(validLocalAddress(fields.to) ? { to: fields.to } : {}),
    ...(fields.bytes ? { bytes: fields.bytes } : {}),
    errorCode: notchError.code,
  });
}

function isTerminalDeliveryError(code: string): boolean {
  return [
    'NOTCH_ARCHIVE_UNSAFE',
    'NOTCH_INBOX_DELIVERY_CONFLICT',
    'NOTCH_INBOX_DELIVERY_INVALID',
    'NOTCH_INBOX_HASH_MISMATCH',
    'NOTCH_INBOX_PRIVATE_PACKET_BLOCKED',
    'NOTCH_RECORD_INVALID',
    'NOTCH_SECRET_DETECTED',
  ].includes(code);
}

function isRetryableDeliveryError(code: string | undefined): boolean {
  return code === 'NOTCH_ARCHIVE_TOO_LARGE' || code === 'NOTCH_PACKET_TOO_LARGE';
}

function validLocalAddress(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    parseLocalInboxAddress(value);
    return true;
  } catch {
    return false;
  }
}
