import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { printInfo, printJson } from '../output.js';
import { loadConfig } from '../../core/config-service.js';
import { createPacket, getPacket, listPackets } from '../../core/packet-service.js';
import { scanForSecrets, type SecretFinding } from '../../core/secret-scan-service.js';
import { importPacketFile } from '../../core/transfer-service.js';
import type { PacketPurpose, Sensitivity, SourceLink } from '../../types/records.js';

type CreatePacketOptions = {
  file?: string[];
  out?: string;
  private?: boolean;
  purpose?: PacketPurpose;
  sensitivity?: Sensitivity;
  summary?: string;
  supersedes?: string;
  task?: string;
  title?: string;
  toAgent?: string;
  toPerson?: string;
  toRepo?: string;
};

type ImportPacketOptions = {
  asReviewed?: boolean;
  into?: string;
  private?: boolean;
};

type ListPacketOptions = {
  inbox?: boolean;
  limit?: string;
  outbox?: boolean;
  private?: boolean;
  purpose?: PacketPurpose;
};

type ShowPacketOptions = {
  inbox?: boolean;
  outbox?: boolean;
  private?: boolean;
};

export function registerPacketCommand(program: Command): void {
  const packet = program.command('packet').description('create, import, list, and show context packets');

  packet
    .command('create')
    .description('create a portable context packet')
    .requiredOption('--title <title>', 'packet title')
    .requiredOption('--summary <summary>', 'packet summary')
    .option('--to-agent <agent>', 'target agent')
    .option('--to-person <person>', 'target person')
    .option('--to-repo <repo>', 'target repo')
    .option('--task <text>', 'task context')
    .option('--purpose <purpose>', 'packet purpose: handoff or seed')
    .option('--sensitivity <sensitivity>', 'packet sensitivity: project or private')
    .option('--supersedes <id>', 'record ID this packet supersedes')
    .option('--private', 'create a private seed packet')
    .option('--file <path>', 'include a source file link', collect, [])
    .option('--out <path>', 'write an additional portable packet file')
    .action(async (options: CreatePacketOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadCurrentConfig(context);
      const sourceLinks: SourceLink[] = (options.file ?? []).map((file) => ({ kind: 'file', path: file }));
      const result = await createPacket(loaded, {
        ...(context.actor ? { actor: context.actor } : {}),
        ...(context.agent ? { agent: context.agent } : {}),
        ...(context.sourceTool ? { sourceTool: context.sourceTool } : {}),
        ...(options.out ? { outputPath: options.out } : {}),
        ...(options.private ? { purpose: 'seed', sensitivity: 'private' } : {}),
        ...(options.purpose && !options.private ? { purpose: options.purpose } : {}),
        ...(options.sensitivity && !options.private ? { sensitivity: options.sensitivity } : {}),
        ...(options.supersedes ? { supersedes: options.supersedes } : {}),
        ...(options.task ? { task: options.task } : {}),
        ...(options.toAgent ? { toAgent: options.toAgent } : {}),
        ...(options.toPerson ? { toPerson: options.toPerson } : {}),
        ...(options.toRepo ? { toRepo: options.toRepo } : {}),
        sourceLinks,
        summary: required(options.summary, '--summary'),
        title: required(options.title, '--title'),
      });

      if (context.output.json) {
        printJson(result);
        return;
      }

      printInfo(`Created packet ${result.packet.id}`, context.output);
      printInfo(result.outboxPath, context.output);
    });

  packet
    .command('import')
    .description('import a packet file into an inbox')
    .argument('<file>')
    .option('--into <repo-or-store-path>', 'destination repo or store path')
    .option('--as-reviewed', 'mark imported packet as reviewed')
    .option('--private', 'force private inbox import')
    .action(async (file: string, options: ImportPacketOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadConfig({
        ...(options.into ? { cwd: options.into } : context.cwd ? { cwd: context.cwd } : {}),
        ...(context.store ? { store: context.store } : {}),
      });
      const result = await importPacketFile(loaded, file, {
        ...(context.actor ? { actor: context.actor } : {}),
        ...(context.agent ? { agent: context.agent } : {}),
        ...(options.asReviewed ? { asReviewed: true } : {}),
        ...(options.private ? { forcePrivate: true } : {}),
        ...(context.sourceTool ? { sourceTool: context.sourceTool } : {}),
      });

      if (context.output.json) {
        printJson(result);
        return;
      }

      printInfo(`Imported packet ${result.packet.id}`, context.output);
      printInfo(result.inboxPath, context.output);
    });

  packet
    .command('list')
    .description('list packets')
    .option('--inbox', 'list inbox packets only')
    .option('--outbox', 'list outbox packets only')
    .option('--private', 'include private packets')
    .option('--purpose <purpose>', 'filter by purpose')
    .option('--limit <n>', 'maximum number of packets')
    .action(async (options: ListPacketOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadCurrentConfig(context);
      const packets = await listPackets(loaded, {
        direction: options.inbox ? 'inbox' : options.outbox ? 'outbox' : 'both',
        includePrivate: Boolean(options.private),
        ...(options.limit ? { limit: Number(options.limit) } : {}),
        ...(options.purpose ? { purpose: options.purpose } : {}),
      });

      if (context.output.json) {
        printJson({ packets });
        return;
      }

      for (const entry of packets) {
        printInfo(`${entry.packet.id}\t${entry.direction}\t${entry.packet.title}`, context.output);
      }
    });

  packet
    .command('show')
    .description('show a packet by ID or slug')
    .argument('<id>')
    .option('--inbox', 'search inbox only')
    .option('--outbox', 'search outbox only')
    .option('--private', 'include private packets')
    .action(async (id: string, options: ShowPacketOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadCurrentConfig(context);
      const result = await getPacket(loaded, id, {
        direction: options.inbox ? 'inbox' : options.outbox ? 'outbox' : 'both',
        includePrivate: Boolean(options.private),
      });

      if (context.output.json) {
        printJson(result);
        return;
      }

      printInfo(result.markdown, context.output);
    });

  packet
    .command('preview')
    .description('preview what an agent will see when reading a packet')
    .argument('<id>')
    .option('--inbox', 'search inbox only')
    .option('--outbox', 'search outbox only')
    .option('--private', 'include private packets')
    .action(async (id: string, options: ShowPacketOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadCurrentConfig(context);
      const result = await getPacket(loaded, id, {
        direction: options.inbox ? 'inbox' : options.outbox ? 'outbox' : 'both',
        includePrivate: Boolean(options.private),
      });
      const scannerFindings = scanForSecrets(result.markdown, loaded.config, {
        field: 'packet markdown',
        path: result.path,
      });

      if (context.output.json) {
        printJson({
          ...result,
          preview: renderPacketPreview(result.markdown, scannerFindings),
          scannerFindings,
        });
        return;
      }

      printInfo(renderPacketPreview(result.markdown, scannerFindings), context.output);
    });
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function required(value: string | undefined, flag: string): string {
  if (!value) {
    throw new Error(`Missing required option ${flag}`);
  }

  return value;
}

async function loadCurrentConfig(context: ReturnType<typeof getCliContext>) {
  return await loadConfig({
    ...(context.cwd ? { cwd: context.cwd } : {}),
    ...(context.store ? { store: context.store } : {}),
  });
}

function renderPacketPreview(markdown: string, scannerFindings: SecretFinding[]): string {
  const warningLines = scannerFindings.map((finding) => {
    const location = [
      finding.path,
      finding.line ? `line ${finding.line}` : undefined,
    ].filter(Boolean).join(' ');

    return `⚠ scanner warning: ${finding.pattern}${location ? ` at ${location}` : ''}`;
  });

  return [
    'Agent Packet Preview',
    'This is what an agent reading this packet will see.',
    ...warningLines,
    '',
    markdown,
  ].join('\n');
}
