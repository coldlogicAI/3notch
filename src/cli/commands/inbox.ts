import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { printInfo, printJson } from '../output.js';
import { loadConfig } from '../../core/config-service.js';
import {
  ackInboxDelivery,
  getInboxDeliveryStatus,
  initializeDurableInbox,
  listInboxDeliveries,
  pullInboxDelivery,
  sendInboxPacket,
} from '../../core/inbox-service.js';
import { NotchException } from '../../types/errors.js';

type InboxInitOptions = {
  name?: string;
  root?: string;
};

type InboxListOptions = {
  all?: boolean;
};

type InboxPullOptions = {
  asReviewed?: boolean;
  import?: boolean;
};

type InboxStatusOptions = {
  at?: string;
};

type SendOptions = {
  to?: string;
};

export function registerInboxCommand(program: Command): void {
  program
    .command('send')
    .description('send a packed packet through the configured durable inbox')
    .argument('<packet>', 'regular .notchpkt file created by notch packet pack')
    .requiredOption('--to <address>', 'registered local recipient address')
    .action(async (packetPath: string, options: SendOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadCurrentConfig(context);
      const result = await sendInboxPacket(loaded, {
        packetPath,
        to: required(options.to, '--to'),
      }, actorOptions(context));

      if (context.output.json) {
        printJson(result);
        return;
      }

      printInfo(
        result.idempotent
          ? `Already delivered packet ${result.packetId} as ${result.deliveryId}`
          : `Sent packet ${result.packetId} as ${result.deliveryId}`,
        context.output,
      );
      printInfo(`To: ${options.to}`, context.output);
      printInfo(`SHA-256: ${result.packetHash}`, context.output);
      printInfo(`Next: ${result.nextAction}`, context.output);
      printInfo('Notice:', context.output);
      printInfo(result.notice, context.output);
    });

  const inbox = program.command('inbox').description('configure and process durable packet deliveries');

  inbox
    .command('init')
    .description('register this store in an explicit local mailbox root')
    .requiredOption('--name <name>', 'local recipient name')
    .requiredOption('--root <path>', 'local or shared mailbox root')
    .action(async (options: InboxInitOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadCurrentConfig(context);
      const result = await initializeDurableInbox(loaded, {
        name: required(options.name, '--name'),
        root: required(options.root, '--root'),
      }, actorOptions(context));

      if (context.output.json) {
        printJson(result);
        return;
      }

      printInfo(
        result.alreadyInitialized
          ? `Durable inbox already ready at ${result.address}`
          : `Durable inbox ready at ${result.address}`,
        context.output,
      );
      printInfo(`Mailbox: ${result.root}`, context.output);
      printInfo(`Next: ${result.nextAction}`, context.output);
    });

  inbox
    .command('list')
    .description('list pending durable deliveries')
    .option('--all', 'include pulled, acknowledged, and rejected deliveries')
    .action(async (options: InboxListOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadCurrentConfig(context);
      const result = await listInboxDeliveries(loaded, { includeAll: Boolean(options.all) });

      if (context.output.json) {
        printJson(result);
        return;
      }

      if (result.deliveries.length === 0) {
        printInfo(`Inbox empty for ${result.address}`, context.output);
        printInfo(`Next: ${result.nextAction}`, context.output);
        return;
      }

      for (const delivery of result.deliveries) {
        printInfo([
          delivery.deliveryId,
          delivery.state,
          delivery.from,
          delivery.packetId,
          `${delivery.bytes} bytes`,
          delivery.createdAt,
        ].join('\t'), context.output);
      }

      printInfo(`Next: ${result.nextAction}`, context.output);
    });

  inbox
    .command('status')
    .description('read retained delivery state by ID')
    .argument('<delivery-id>')
    .option('--at <address>', 'registered local recipient address to inspect')
    .action(async (deliveryId: string, options: InboxStatusOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadCurrentConfig(context);
      const result = await getInboxDeliveryStatus(loaded, {
        deliveryId,
        ...(options.at ? { address: options.at } : {}),
      });

      if (context.output.json) {
        printJson(result);
        return;
      }

      printInfo(`Delivery ${result.deliveryId} is ${result.state} at ${result.address}`, context.output);
      printInfo(`From: ${result.delivery.from}`, context.output);
      printInfo(`To: ${result.delivery.to}`, context.output);
      printInfo(`Packet: ${result.packetId}`, context.output);
      printInfo(`SHA-256: ${result.packetHash}`, context.output);

      if (result.importedPacketId) {
        printInfo(`Imported: ${result.importedPacketId}`, context.output);
      }

      if (result.delivery.errorCode) {
        printInfo(`Error: ${result.delivery.errorCode}`, context.output);
      }

      printInfo(`Next: ${result.nextAction}`, context.output);
    });

  inbox
    .command('pull')
    .description('verify a delivery and optionally import it into this store')
    .argument('<delivery-id>')
    .option('--import', 'import through normal 3Notch validation after byte verification')
    .option('--as-reviewed', 'mark an imported packet as reviewed')
    .action(async (deliveryId: string, options: InboxPullOptions, command: Command) => {
      if (options.asReviewed && !options.import) {
        throw new NotchException({
          code: 'NOTCH_INBOX_IMPORT_REQUIRED',
          message: '--as-reviewed requires --import.',
          recovery: 'Add --import, or remove --as-reviewed to verify without importing.',
          severity: 'error',
          exitCode: 1,
        });
      }

      const context = getCliContext(command);
      const loaded = await loadCurrentConfig(context);
      const result = await pullInboxDelivery(loaded, {
        deliveryId,
        import: Boolean(options.import),
        asReviewed: Boolean(options.asReviewed),
      }, actorOptions(context));

      if (context.output.json) {
        printJson(result);
        return;
      }

      printInfo(
        result.importedPacketId
          ? `Imported packet ${result.importedPacketId} from ${result.deliveryId}`
          : `Verified delivery ${result.deliveryId}`,
        context.output,
      );
      printInfo(result.packetPath, context.output);
      printInfo(`SHA-256: ${result.packetHash}`, context.output);
      printInfo(`Next: ${result.nextAction}`, context.output);
    });

  inbox
    .command('ack')
    .description('acknowledge a processed delivery without deleting it')
    .argument('<delivery-id>')
    .action(async (deliveryId: string, _options: object, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadCurrentConfig(context);
      const result = await ackInboxDelivery(loaded, { deliveryId }, actorOptions(context));

      if (context.output.json) {
        printJson(result);
        return;
      }

      printInfo(`Acknowledged delivery ${result.deliveryId}`, context.output);
      printInfo('Packet bytes retained for audit.', context.output);
    });
}

function actorOptions(context: ReturnType<typeof getCliContext>) {
  return {
    ...(context.actor ? { actor: context.actor } : {}),
    ...(context.agent ? { agent: context.agent } : {}),
    ...(context.sourceTool ? { sourceTool: context.sourceTool } : {}),
  };
}

async function loadCurrentConfig(context: ReturnType<typeof getCliContext>) {
  return await loadConfig({
    ...(context.cwd ? { cwd: context.cwd } : {}),
    ...(context.store ? { store: context.store } : {}),
  });
}

function required(value: string | undefined, flag: string): string {
  if (!value) {
    throw new NotchException({
      code: 'NOTCH_OPTION_REQUIRED',
      message: `Missing required option ${flag}.`,
      recovery: `Re-run with ${flag} <value>.`,
      severity: 'error',
      exitCode: 1,
    });
  }

  return value;
}
