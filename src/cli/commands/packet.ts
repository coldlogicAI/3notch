import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { printInfo, printJson } from '../output.js';
import { createPacketArchive, unpackPacketArchiveToTemp } from '../../core/archive-service.js';
import { parseArtifactFileSpec, type ArtifactFileInput } from '../../core/artifact-service.js';
import { loadConfig } from '../../core/config-service.js';
import { createPacket, getPacket, listPackets } from '../../core/packet-service.js';
import { scanForSecrets, type SecretFinding } from '../../core/secret-scan-service.js';
import { importPacketFile, importPacketFolder, importPacketMarkdown } from '../../core/transfer-service.js';
import type { PacketPurpose, Sensitivity, SourceLink } from '../../types/records.js';

type CreatePacketOptions = {
  file?: string[];
  nextSteps?: string;
  out?: string;
  private?: boolean;
  purpose?: PacketPurpose;
  ref?: string[];
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

type PackPacketOptions = {
  output?: string;
};

type UnpackPacketOptions = ImportPacketOptions;

export function registerPacketCommand(program: Command): void {
  const packet = program.command('packet').description('create, import, pack, preview, and manage context packets');

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
    .option('--file <path[:purpose]>', 'copy a file into packet artifacts; purpose: asset, source, reference, or output; favicon/icon/logo/image become asset', collect, [])
    .option('--ref <path>', 'include a source file reference without copying bytes', collect, [])
    .option('--next-steps <text>', 'instructions for the receiving agent')
    .option('--out <path>', 'write an additional portable packet file')
    .action(async (options: CreatePacketOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadCurrentConfig(context);
      const files: ArtifactFileInput[] = (options.file ?? []).map(parseArtifactFileSpec);
      const sourceLinks: SourceLink[] = (options.ref ?? []).map((file) => ({ kind: 'file', path: file }));
      const result = await createPacket(loaded, {
        ...(context.actor ? { actor: context.actor } : {}),
        ...(context.agent ? { agent: context.agent } : {}),
        ...(context.sourceTool ? { sourceTool: context.sourceTool } : {}),
        files,
        ...(options.nextSteps ? { nextSteps: options.nextSteps } : {}),
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
    .command('pack')
    .description('pack a packet folder into a deterministic .notchpkt archive')
    .argument('<id>')
    .option('--output <path>', 'archive output path, or - for stdout')
    .action(async (id: string, options: PackPacketOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadCurrentConfig(context);
      const result = await getPacket(loaded, id, { includePrivate: true });
      const archive = await createPacketArchive({
        markdownPath: result.markdownPath,
        rootPath: result.rootPath,
      });
      const output = options.output ?? path.resolve(context.cwd ?? process.cwd(), `${result.packet.id}.notchpkt`);

      if (output === '-') {
        process.stdout.write(archive);
        return;
      }

      const archivePath = path.isAbsolute(output) ? output : path.resolve(context.cwd ?? process.cwd(), output);
      await writeFile(archivePath, archive);

      if (context.output.json) {
        printJson({ archivePath, bytes: archive.byteLength, packet: result.packet });
        return;
      }

      printInfo(`Packed packet ${result.packet.id}`, context.output);
      printInfo(archivePath, context.output);
      printInfo([
        '',
        'To receive this packet in another repo:',
        '  cd /path/to/destination-repo',
        '  notch onboard --yes',
        `  notch packet unpack ${quoteShellArg(archivePath)}`,
      ].join('\n'), context.output);
    });

  packet
    .command('unpack')
    .description('unpack a .notchpkt archive into an inbox')
    .argument('<archive>')
    .option('--into <repo-or-store-path>', 'destination repo or store path')
    .option('--as-reviewed', 'mark imported packet as reviewed')
    .option('--private', 'force private inbox import')
    .action(async (archivePath: string, options: UnpackPacketOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadConfig({
        ...(options.into ? { cwd: options.into } : context.cwd ? { cwd: context.cwd } : {}),
        ...(context.store ? { store: context.store } : {}),
      });
      const importOptions = {
        ...(context.actor ? { actor: context.actor } : {}),
        ...(context.agent ? { agent: context.agent } : {}),
        ...(options.asReviewed ? { asReviewed: true } : {}),
        ...(options.private ? { forcePrivate: true } : {}),
        ...(context.sourceTool ? { sourceTool: context.sourceTool } : {}),
      };
      const archive = archivePath === '-'
        ? await readStdinBuffer()
        : await readFile(path.isAbsolute(archivePath) ? archivePath : path.resolve(context.cwd ?? process.cwd(), archivePath));
      const unpacked = await unpackPacketArchiveToTemp(archive);

      try {
        const result = await importPacketFolder(loaded, unpacked.packetFolderPath, importOptions);

        if (context.output.json) {
          printJson(result);
          return;
        }

        printInfo(`Unpacked packet ${result.packet.id}`, context.output);
        printInfo(result.inboxPath, context.output);
      } finally {
        await unpacked.cleanup();
      }
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
      const importOptions = {
        ...(context.actor ? { actor: context.actor } : {}),
        ...(context.agent ? { agent: context.agent } : {}),
        ...(options.asReviewed ? { asReviewed: true } : {}),
        ...(options.private ? { forcePrivate: true } : {}),
        ...(context.sourceTool ? { sourceTool: context.sourceTool } : {}),
      };
      const result = file === '-'
        ? await importPacketMarkdown(loaded, await readStdin(), 'stdin', importOptions)
        : await importPacketFile(loaded, file, importOptions);

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
          preview: renderPacketPreview(result.markdown, scannerFindings, result.packet),
          scannerFindings,
        });
        return;
      }

      printInfo(renderPacketPreview(result.markdown, scannerFindings, result.packet), context.output);
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

function renderPacketPreview(markdown: string, scannerFindings: SecretFinding[], packet: { artifacts?: Array<{ bytes: number; path: string; sha256: string }> }): string {
  const warningLines = scannerFindings.map((finding) => {
    const location = [
      finding.path,
      finding.line ? `line ${finding.line}` : undefined,
    ].filter(Boolean).join(' ');

    return `⚠ scanner warning: ${finding.pattern}${location ? ` at ${location}` : ''}`;
  });
  const artifacts = packet.artifacts ?? [];
  const artifactLines = artifacts.length > 0
    ? [
        'Artifacts',
        'path\tsha256\tbytes',
        ...artifacts.map((artifact) => `${artifact.path}\t${artifact.sha256.slice(0, 12)}\t${artifact.bytes}`),
        '',
      ]
    : [];

  return [
    'Agent Packet Preview',
    'This is what an agent reading this packet will see.',
    ...warningLines,
    '',
    ...artifactLines,
    markdown,
  ].join('\n');
}

function quoteShellArg(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

async function readStdin(): Promise<string> {
  return (await readStdinBuffer()).toString('utf8');
}

async function readStdinBuffer(): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}
