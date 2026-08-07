import { randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { sha256 } from './artifact-service.js';
import { schemaService } from './schema-service.js';
import { atomicWriteFile } from './store-service.js';
import { withStoreWriteLock } from './store-lock-service.js';
import { toSlug } from './id-service.js';
import { NotchException } from '../types/errors.js';
import type { LoadedConfig } from './config-service.js';
import type { InboxConfig, InboxDelivery, InboxDeliveryState } from '../types/inbox.js';

const inboxConfigFilename = 'inbox-config.json';
const addressPattern = /^local:([a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?)$/;
const deliveryIdPattern = /^delivery_[a-f0-9]{24}$/;
const hashPattern = /^[a-f0-9]{64}$/;

export type PutLocalDeliveryInput = {
  delivery: InboxDelivery;
  packet: Buffer;
};

export type PutLocalDeliveryResult = {
  delivery: InboxDelivery;
  idempotent: boolean;
  packetPath: string;
};

export type LockedLocalDelivery = {
  delivery: InboxDelivery;
  packet: Buffer;
  packetPath: string;
  update: (changes: {
    state: InboxDeliveryState;
    pulledAt?: string;
    ackedAt?: string;
    rejectedAt?: string;
    importedAt?: string;
    importedPacketId?: string;
    errorCode?: string;
    clearRejection?: boolean;
  }) => Promise<InboxDelivery>;
};

export interface InboxTransportAdapter {
  initializeRecipient: (address: string) => Promise<void>;
  putDelivery: (address: string, input: PutLocalDeliveryInput) => Promise<PutLocalDeliveryResult>;
  listDeliveries: (address: string, options?: { includeAll?: boolean }) => Promise<InboxDelivery[]>;
  withDelivery: <T>(
    address: string,
    deliveryId: string,
    options: { maxBytes: number },
    operation: (delivery: LockedLocalDelivery) => Promise<T>,
  ) => Promise<T>;
}

export function inboxConfigPath(context: LoadedConfig): string {
  return path.join(context.storePath, inboxConfigFilename);
}

export function normalizeInboxName(value: string): string {
  const name = toSlug(value)
    .slice(0, 64)
    .replace(/[-._]+$/u, '');

  if (!name || !/^[a-z0-9]/u.test(name)) {
    throw new NotchException({
      code: 'NOTCH_INBOX_ADDRESS_INVALID',
      message: `Inbox name cannot form a safe local address: ${value}`,
      recovery: 'Use letters, numbers, dots, underscores, or hyphens.',
      severity: 'error',
      exitCode: 1,
    });
  }

  return name;
}

export function localInboxAddress(name: string): string {
  return `local:${normalizeInboxName(name)}`;
}

export function parseLocalInboxAddress(address: string): string {
  const match = addressPattern.exec(address);

  if (!match?.[1]) {
    throw new NotchException({
      code: 'NOTCH_INBOX_ADDRESS_INVALID',
      message: `Invalid local inbox address: ${address}`,
      recovery: 'Use the exact address printed by notch inbox init, such as local:review-agent.',
      severity: 'error',
      exitCode: 1,
    });
  }

  return match[1];
}

export function deliveryIdForPacketId(packetId: string): string {
  return `delivery_${sha256(packetId).slice(0, 24)}`;
}

export async function loadInboxConfig(context: LoadedConfig): Promise<InboxConfig> {
  const configPath = inboxConfigPath(context);
  const configStat = await lstat(configPath).catch(() => undefined);

  if (!configStat) {
    throw new NotchException({
      code: 'NOTCH_INBOX_NOT_CONFIGURED',
      message: 'This 3Notch store has no durable inbox configuration.',
      path: configPath,
      recovery: 'Run notch inbox init --name <name> --root <mailbox-path>.',
      severity: 'error',
      exitCode: 2,
    });
  }

  if (configStat.isSymbolicLink()) {
    throw symlinkError(configPath);
  }

  if (!configStat.isFile()) {
    throw invalidConfig(configPath, 'Inbox config must be a regular file.');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(configPath, 'utf8')) as unknown;
  } catch (error) {
    throw invalidConfig(configPath, error instanceof Error ? error.message : 'Inbox config is not readable JSON.');
  }

  const validation = schemaService.validate<InboxConfig>('inboxConfig', parsed, configPath);

  if (!validation.ok) {
    throw invalidConfig(configPath, validation.errors[0]?.message ?? 'Inbox config is invalid.');
  }

  const config = validation.data;

  if (!path.isAbsolute(config.root) || localInboxAddress(config.name) !== config.address) {
    throw invalidConfig(configPath, 'Inbox config root must be absolute and its name/address must agree.');
  }

  return config;
}

export async function initializeInboxConfig(
  context: LoadedConfig,
  input: { name: string; root: string },
): Promise<{ config: InboxConfig; alreadyInitialized: boolean }> {
  const name = normalizeInboxName(input.name);
  const root = path.resolve(context.projectRoot, input.root);
  const config: InboxConfig = {
    schemaVersion: '1.0.0',
    transport: 'local',
    name,
    address: `local:${name}`,
    root,
  };
  const configPath = inboxConfigPath(context);
  const existing = await lstat(configPath).catch(() => undefined);

  if (existing) {
    const current = await loadInboxConfig(context);

    if (JSON.stringify(current) !== JSON.stringify(config)) {
      throw new NotchException({
        code: 'NOTCH_INBOX_ALREADY_CONFIGURED',
        message: `Durable inbox is already configured as ${current.address}.`,
        path: configPath,
        recovery: 'Use the existing address, or remove inbox-config.json intentionally before configuring a different mailbox.',
        severity: 'error',
        exitCode: 6,
      });
    }

    await new LocalInboxAdapter(root).initializeRecipient(config.address);
    return { config, alreadyInitialized: true };
  }

  await new LocalInboxAdapter(root).initializeRecipient(config.address);
  await atomicWriteFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  await chmod(configPath, 0o600).catch(() => undefined);
  await ensureIgnoredConfig(context.storePath);
  return { config, alreadyInitialized: false };
}

export class LocalInboxAdapter implements InboxTransportAdapter {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(root);
  }

  async initializeRecipient(address: string): Promise<void> {
    const recipient = parseLocalInboxAddress(address);
    await this.ensureRoot();
    const recipientsPath = this.recipientsPath();
    const recipientPath = path.join(recipientsPath, recipient);
    await ensureChildDirectory(recipientsPath, recipientPath);
    await ensureChildDirectory(recipientPath, path.join(recipientPath, 'deliveries'));
  }

  async putDelivery(address: string, input: PutLocalDeliveryInput): Promise<PutLocalDeliveryResult> {
    this.assertDeliveryId(input.delivery.deliveryId);
    this.validateDelivery(input.delivery);

    if (input.delivery.to !== address) {
      throw new NotchException({
        code: 'NOTCH_INBOX_DELIVERY_CONFLICT',
        message: `Delivery target ${input.delivery.to} does not match recipient ${address}.`,
        recovery: 'Use the same registered address in delivery metadata and adapter routing.',
        severity: 'error',
        exitCode: 6,
      });
    }

    if (input.packet.byteLength !== input.delivery.bytes || sha256(input.packet) !== input.delivery.packetHash) {
      throw new NotchException({
        code: 'NOTCH_INBOX_HASH_MISMATCH',
        message: 'Delivery metadata does not match the packet bytes.',
        recovery: 'Re-pack the packet and retry. Do not edit .notchpkt bytes in place.',
        severity: 'error',
        exitCode: 5,
      });
    }

    const recipientPath = await this.assertRecipient(address);

    return await withStoreWriteLock(recipientPath, async () => {
      const deliveriesPath = path.join(recipientPath, 'deliveries');
      const deliveryPath = path.join(deliveriesPath, input.delivery.deliveryId);
      const existing = await lstat(deliveryPath).catch(() => undefined);

      if (existing) {
        return await this.resolveExistingDelivery(deliveryPath, input.delivery);
      }

      const temporaryPath = path.join(
        deliveriesPath,
        `.${input.delivery.deliveryId}.${process.pid}.${randomUUID()}.tmp`,
      );

      try {
        await mkdir(temporaryPath, { mode: 0o700 });
        await writeFile(path.join(temporaryPath, 'packet.notchpkt'), input.packet, { flag: 'wx', mode: 0o600 });
        await writeFile(path.join(temporaryPath, 'packet.sha256'), `${input.delivery.packetHash}\n`, { flag: 'wx', mode: 0o600 });
        await writeFile(
          path.join(temporaryPath, 'delivery.json'),
          `${JSON.stringify(input.delivery, null, 2)}\n`,
          { flag: 'wx', mode: 0o600 },
        );
        await rename(temporaryPath, deliveryPath);
      } catch (error) {
        await rm(temporaryPath, { force: true, recursive: true });

        if (await lstat(deliveryPath).catch(() => undefined)) {
          return await this.resolveExistingDelivery(deliveryPath, input.delivery);
        }

        throw error;
      }

      return {
        delivery: input.delivery,
        idempotent: false,
        packetPath: path.join(deliveryPath, 'packet.notchpkt'),
      };
    });
  }

  async listDeliveries(address: string, options: { includeAll?: boolean } = {}): Promise<InboxDelivery[]> {
    const recipientPath = await this.assertRecipient(address);
    const deliveriesPath = path.join(recipientPath, 'deliveries');
    const entries = await readdir(deliveriesPath, { withFileTypes: true });
    const deliveries: InboxDelivery[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      if (!deliveryIdPattern.test(entry.name)) {
        continue;
      }

      if (!entry.isDirectory()) {
        throw malformedDelivery(path.join(deliveriesPath, entry.name), 'Unexpected entry in the delivery store.');
      }

      const delivery = await this.readDeliveryMetadata(path.join(deliveriesPath, entry.name));

      if (options.includeAll || delivery.state === 'pending') {
        deliveries.push(delivery);
      }
    }

    return deliveries.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async withDelivery<T>(
    address: string,
    deliveryId: string,
    options: { maxBytes: number },
    operation: (delivery: LockedLocalDelivery) => Promise<T>,
  ): Promise<T> {
    this.assertDeliveryId(deliveryId);
    const recipientPath = await this.assertRecipient(address);

    return await withStoreWriteLock(recipientPath, async () => {
      const deliveryPath = path.join(recipientPath, 'deliveries', deliveryId);
      let delivery = await this.readDeliveryMetadata(deliveryPath);
      let packet: Buffer;

      try {
        packet = await this.readVerifiedPacket(deliveryPath, delivery, options.maxBytes);
      } catch (error) {
        if (!isTerminalDeliveryReadError(error)) {
          throw error;
        }

        const now = new Date().toISOString();
        delivery = await this.writeDeliveryMetadata(deliveryPath, {
          ...delivery,
          state: 'rejected',
          rejectedAt: delivery.rejectedAt ?? now,
          updatedAt: now,
          errorCode: error instanceof NotchException ? error.notchError.code : 'NOTCH_INBOX_READ_FAILED',
        });
        throw error;
      }

      return await operation({
        delivery,
        packet,
        packetPath: path.join(deliveryPath, 'packet.notchpkt'),
        update: async (changes) => {
          const now = new Date().toISOString();
          const next: InboxDelivery = {
            ...delivery,
            state: changes.state,
            updatedAt: now,
            ...(changes.pulledAt ? { pulledAt: changes.pulledAt } : {}),
            ...(changes.ackedAt ? { ackedAt: changes.ackedAt } : {}),
            ...(changes.rejectedAt ? { rejectedAt: changes.rejectedAt } : {}),
            ...(changes.importedAt ? { importedAt: changes.importedAt } : {}),
            ...(changes.importedPacketId ? { importedPacketId: changes.importedPacketId } : {}),
            ...(changes.errorCode ? { errorCode: changes.errorCode } : {}),
          };

          if (changes.clearRejection) {
            delete next.rejectedAt;
            delete next.errorCode;
          }

          delivery = await this.writeDeliveryMetadata(deliveryPath, next);
          return delivery;
        },
      });
    });
  }

  private async ensureRoot(): Promise<void> {
    const parent = path.dirname(this.root);
    const parentStat = await lstat(parent).catch(() => undefined);

    if (!parentStat?.isDirectory()) {
      await mkdir(parent, { recursive: true });
    }

    await ensureDirectory(this.root);
    await ensureChildDirectory(this.root, this.recipientsPath());
  }

  private recipientsPath(): string {
    return path.join(this.root, 'recipients');
  }

  private async assertRecipient(address: string): Promise<string> {
    const recipient = parseLocalInboxAddress(address);
    await this.ensureRoot();
    const recipientPath = path.join(this.recipientsPath(), recipient);
    const recipientStat = await lstat(recipientPath).catch(() => undefined);

    if (!recipientStat) {
      throw new NotchException({
        code: 'NOTCH_INBOX_RECIPIENT_NOT_FOUND',
        message: `Recipient is not registered in this mailbox: ${address}`,
        path: recipientPath,
        recovery: 'Ask the receiver to run notch inbox init with this mailbox root, then use the printed address.',
        severity: 'error',
        exitCode: 2,
      });
    }

    assertDirectoryStat(recipientPath, recipientStat);
    const deliveriesPath = path.join(recipientPath, 'deliveries');
    const deliveriesStat = await lstat(deliveriesPath).catch(() => undefined);

    if (!deliveriesStat) {
      throw malformedDelivery(deliveriesPath, 'Recipient delivery directory is missing.');
    }

    assertDirectoryStat(deliveriesPath, deliveriesStat);
    return recipientPath;
  }

  private async resolveExistingDelivery(
    deliveryPath: string,
    expected: InboxDelivery,
  ): Promise<PutLocalDeliveryResult> {
    const existing = await this.readDeliveryMetadata(deliveryPath);

    if (
      existing.deliveryId !== expected.deliveryId
      || existing.packetId !== expected.packetId
      || existing.packetHash !== expected.packetHash
      || existing.bytes !== expected.bytes
      || existing.from !== expected.from
      || existing.to !== expected.to
    ) {
      throw new NotchException({
        code: 'NOTCH_INBOX_DELIVERY_CONFLICT',
        message: `Delivery ${expected.deliveryId} already exists with different packet metadata.`,
        path: deliveryPath,
        recovery: 'Do not reuse a packet ID for different bytes. Create a new packet or restore the original archive.',
        severity: 'error',
        exitCode: 6,
      });
    }

    await this.readVerifiedPacket(deliveryPath, existing, Number.MAX_SAFE_INTEGER);

    if (existing.state === 'rejected') {
      throw new NotchException({
        code: 'NOTCH_INBOX_STATE_INVALID',
        message: `Delivery ${expected.deliveryId} was rejected and was not resent.`,
        path: deliveryPath,
        recovery: 'Correct the packet, create a new packet ID, and send that archive. For a local size-limit failure, raise the receiver limit and pull the existing delivery again.',
        severity: 'error',
        exitCode: 6,
      });
    }

    return {
      delivery: existing,
      idempotent: true,
      packetPath: path.join(deliveryPath, 'packet.notchpkt'),
    };
  }

  private async readDeliveryMetadata(deliveryPath: string): Promise<InboxDelivery> {
    const deliveryStat = await lstat(deliveryPath).catch(() => undefined);

    if (!deliveryStat) {
      throw new NotchException({
        code: 'NOTCH_INBOX_DELIVERY_NOT_FOUND',
        message: `Inbox delivery was not found: ${path.basename(deliveryPath)}`,
        recovery: 'Run notch inbox list --all and use an existing delivery ID.',
        severity: 'error',
        exitCode: 2,
      });
    }

    assertDirectoryStat(deliveryPath, deliveryStat);
    const metadataPath = path.join(deliveryPath, 'delivery.json');
    const metadataStat = await lstat(metadataPath).catch(() => undefined);

    if (!metadataStat?.isFile() || metadataStat.isSymbolicLink()) {
      throw malformedDelivery(metadataPath, 'Delivery metadata must be a regular file.');
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(await readFile(metadataPath, 'utf8')) as unknown;
    } catch (error) {
      throw malformedDelivery(metadataPath, error instanceof Error ? error.message : 'Delivery metadata is invalid JSON.');
    }

    const validation = schemaService.validate<InboxDelivery>('inboxDelivery', parsed, metadataPath);

    if (!validation.ok) {
      throw malformedDelivery(metadataPath, validation.errors[0]?.message ?? 'Delivery metadata is invalid.');
    }

    if (validation.data.deliveryId !== path.basename(deliveryPath)) {
      throw malformedDelivery(metadataPath, 'Delivery ID does not match its directory.');
    }

    this.assertDeliveryInvariants(validation.data, metadataPath);
    return validation.data;
  }

  private async readVerifiedPacket(deliveryPath: string, delivery: InboxDelivery, maxBytes: number): Promise<Buffer> {
    const packetPath = path.join(deliveryPath, 'packet.notchpkt');
    const hashPath = path.join(deliveryPath, 'packet.sha256');
    const packetStat = await lstat(packetPath).catch(() => undefined);
    const hashStat = await lstat(hashPath).catch(() => undefined);

    if (!packetStat?.isFile() || packetStat.isSymbolicLink()) {
      throw malformedDelivery(packetPath, 'Delivery packet must be a regular file.');
    }

    if (!hashStat?.isFile() || hashStat.isSymbolicLink()) {
      throw malformedDelivery(hashPath, 'Delivery hash must be a regular file.');
    }

    if (packetStat.size > maxBytes) {
      throw new NotchException({
        code: 'NOTCH_ARCHIVE_TOO_LARGE',
        message: `Delivery archive exceeds the configured packet limit (${packetStat.size} > ${maxBytes}).`,
        path: packetPath,
        recovery: 'Reject the delivery or raise the packet limit only after reviewing the source.',
        severity: 'error',
        exitCode: 5,
      });
    }

    const sidecar = (await readFile(hashPath, 'utf8')).trim();

    if (!hashPattern.test(sidecar) || sidecar !== delivery.packetHash) {
      throw hashMismatch(packetPath);
    }

    const packet = await readFile(packetPath);

    if (packet.byteLength !== delivery.bytes || sha256(packet) !== delivery.packetHash) {
      throw hashMismatch(packetPath);
    }

    return packet;
  }

  private async writeDeliveryMetadata(deliveryPath: string, delivery: InboxDelivery): Promise<InboxDelivery> {
    this.validateDelivery(delivery);
    await atomicWriteFile(path.join(deliveryPath, 'delivery.json'), `${JSON.stringify(delivery, null, 2)}\n`);
    await chmod(path.join(deliveryPath, 'delivery.json'), 0o600).catch(() => undefined);
    return delivery;
  }

  private validateDelivery(delivery: InboxDelivery): void {
    const validation = schemaService.validate<InboxDelivery>('inboxDelivery', delivery);

    if (!validation.ok) {
      throw malformedDelivery(delivery.deliveryId, validation.errors[0]?.message ?? 'Delivery metadata is invalid.');
    }

    this.assertDeliveryInvariants(validation.data, delivery.deliveryId);
  }

  private assertDeliveryInvariants(delivery: InboxDelivery, metadataPath: string): void {
    if (delivery.deliveryId !== deliveryIdForPacketId(delivery.packetId)) {
      throw malformedDelivery(metadataPath, 'Delivery ID does not match its packet ID.');
    }

    if (Date.parse(delivery.updatedAt) < Date.parse(delivery.createdAt)) {
      throw malformedDelivery(metadataPath, 'Delivery update time precedes its creation time.');
    }

    if (delivery.state === 'pending' && (
      delivery.pulledAt
      || delivery.ackedAt
      || delivery.rejectedAt
      || delivery.importedAt
      || delivery.importedPacketId
      || delivery.errorCode
    )) {
      throw malformedDelivery(metadataPath, 'Pending delivery contains completed lifecycle fields.');
    }

    if (delivery.state === 'pulled' && (
      !delivery.pulledAt
      || delivery.ackedAt
      || delivery.rejectedAt
      || delivery.errorCode
    )) {
      throw malformedDelivery(metadataPath, 'Pulled delivery has inconsistent lifecycle fields.');
    }

    if (delivery.state === 'acked' && (!delivery.ackedAt || delivery.rejectedAt || delivery.errorCode)) {
      throw malformedDelivery(metadataPath, 'Acknowledged delivery has inconsistent lifecycle fields.');
    }

    if (delivery.state === 'rejected' && (!delivery.rejectedAt || !delivery.errorCode)) {
      throw malformedDelivery(metadataPath, 'Rejected delivery must record its time and error code.');
    }

    if (Boolean(delivery.importedAt) !== Boolean(delivery.importedPacketId)) {
      throw malformedDelivery(metadataPath, 'Imported delivery fields must be recorded together.');
    }

    if (delivery.importedPacketId && (!delivery.pulledAt || delivery.importedPacketId !== delivery.packetId)) {
      throw malformedDelivery(metadataPath, 'Imported delivery does not match the pulled packet.');
    }
  }

  private assertDeliveryId(deliveryId: string): void {
    if (!deliveryIdPattern.test(deliveryId)) {
      throw new NotchException({
        code: 'NOTCH_INBOX_DELIVERY_ID_INVALID',
        message: `Invalid delivery ID: ${deliveryId}`,
        recovery: 'Copy a delivery ID exactly from notch inbox list.',
        severity: 'error',
        exitCode: 1,
      });
    }
  }
}

async function ensureIgnoredConfig(storePath: string): Promise<void> {
  const gitignorePath = path.join(storePath, '.gitignore');
  const existing = await readFile(gitignorePath, 'utf8').catch(() => '');
  const lines = existing.split(/\r?\n/u);

  if (lines.some((line) => line.trim() === inboxConfigFilename)) {
    return;
  }

  const prefix = existing.trimEnd();
  await atomicWriteFile(gitignorePath, `${prefix ? `${prefix}\n` : ''}${inboxConfigFilename}\n`);
}

async function ensureDirectory(directory: string): Promise<void> {
  const existing = await lstat(directory).catch(() => undefined);

  if (!existing) {
    await mkdir(directory, { mode: 0o700 });
    return;
  }

  assertDirectoryStat(directory, existing);
}

async function ensureChildDirectory(parent: string, child: string): Promise<void> {
  const relative = path.relative(parent, child);

  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new NotchException({
      code: 'NOTCH_PATH_OUTSIDE_STORE',
      message: `Inbox path escapes its managed root: ${child}`,
      path: child,
      recovery: 'Use the mailbox root and address printed by notch inbox init.',
      severity: 'error',
      exitCode: 5,
    });
  }

  const parentStat = await lstat(parent);
  assertDirectoryStat(parent, parentStat);
  const existing = await lstat(child).catch(() => undefined);

  if (!existing) {
    await mkdir(child, { mode: 0o700 });
    return;
  }

  assertDirectoryStat(child, existing);
}

function assertDirectoryStat(directory: string, stat: Awaited<ReturnType<typeof lstat>>): void {
  if (stat.isSymbolicLink()) {
    throw symlinkError(directory);
  }

  if (!stat.isDirectory()) {
    throw malformedDelivery(directory, 'Managed inbox path must be a directory.');
  }
}

function invalidConfig(configPath: string, message: string): NotchException {
  return new NotchException({
    code: 'NOTCH_INBOX_CONFIG_INVALID',
    message,
    path: configPath,
    recovery: 'Fix or remove .notch/inbox-config.json, then run notch inbox init again.',
    severity: 'error',
    exitCode: 3,
  });
}

function malformedDelivery(filePath: string, message: string): NotchException {
  return new NotchException({
    code: 'NOTCH_INBOX_DELIVERY_INVALID',
    message,
    path: filePath,
    recovery: 'Do not edit mailbox files manually. Restore the delivery from the sender or move the damaged directory aside.',
    severity: 'error',
    exitCode: 5,
  });
}

function hashMismatch(packetPath: string): NotchException {
  return new NotchException({
    code: 'NOTCH_INBOX_HASH_MISMATCH',
    message: 'Delivery packet bytes do not match the recorded SHA-256 hash.',
    path: packetPath,
    recovery: 'Do not import this delivery. Ask the sender to retry from the original packet.',
    severity: 'error',
    exitCode: 5,
  });
}

function symlinkError(filePath: string): NotchException {
  return new NotchException({
    code: 'NOTCH_SYMLINK_REJECTED',
    message: `Durable inbox does not follow symlinks in its managed path: ${filePath}`,
    path: filePath,
    recovery: 'Use real directories and regular files for the mailbox root and deliveries.',
    severity: 'error',
    exitCode: 5,
  });
}

function isTerminalDeliveryReadError(error: unknown): boolean {
  if (!(error instanceof NotchException)) {
    return false;
  }

  return [
    'NOTCH_INBOX_DELIVERY_INVALID',
    'NOTCH_INBOX_HASH_MISMATCH',
  ].includes(error.notchError.code);
}
