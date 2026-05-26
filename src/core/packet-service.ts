import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { appendAuditEntry } from './audit-service.js';
import { manifestBundleFile, preparePacketArtifacts, type ArtifactFileInput } from './artifact-service.js';
import { assertSafeRelativePath } from './path-safety.js';
import { createRecordMeta } from './record-factory.js';
import { parseAndValidateRecord } from './record-parser.js';
import { assertNoSecretsWithAudit } from './secret-scan-service.js';
import { rebuildIndex } from './index-service.js';
import { atomicWriteFile, isValidScannedRecord, renderMarkdownRecord, scanMarkdownRecords, writePacketBundleWithCollisionHandling, writeRecordWithCollisionHandling, type ValidScannedRecord } from './store-service.js';
import { packetRootPath, packetSlugFromMarkdownPath, toStoreRelativePath } from './store-layout.js';
import { toSlug } from './id-service.js';
import { NotchException, type NotchError } from '../types/errors.js';
import type { LoadedConfig } from './config-service.js';
import type { NotchPacket, PacketPurpose, PacketRecordRef, ReplyStatus, ReplyType, Sensitivity, SourceLink } from '../types/records.js';

export type CreatePacketInput = {
  actor?: string | undefined;
  agent?: string | undefined;
  destination?: 'outbox' | 'private-inbox' | undefined;
  files?: ArtifactFileInput[];
  includedRecords?: PacketRecordRef[];
  importNotes?: string | undefined;
  mcp?: boolean | undefined;
  nextSteps?: string | undefined;
  outputPath?: string | undefined;
  purpose?: PacketPurpose | undefined;
  replyStatus?: ReplyStatus | undefined;
  replyTo?: string | undefined;
  replyType?: ReplyType | undefined;
  requireRecipient?: boolean | undefined;
  sensitivity?: Sensitivity | undefined;
  sourceLinks?: SourceLink[];
  sourceTool?: NotchPacket['sourceTool']['name'] | undefined;
  summary: string;
  supersedes?: string | undefined;
  tags?: string[] | undefined;
  task?: string | undefined;
  title: string;
  toAgent?: string | undefined;
  toPerson?: string | undefined;
  toRepo?: string | undefined;
};

export type CreateMarkInput = {
  actor?: string | undefined;
  agent?: string | undefined;
  mcp?: boolean | undefined;
  sourceLinks?: SourceLink[];
  sourceTool?: NotchPacket['sourceTool']['name'] | undefined;
  summary: string;
  supersedes?: string | undefined;
  tags?: string[] | undefined;
  title?: string | undefined;
};

export type CreateReplyInput = {
  actor?: string | undefined;
  agent?: string | undefined;
  mcp?: boolean | undefined;
  files?: ArtifactFileInput[];
  nextSteps?: string | undefined;
  parentId: string;
  private?: boolean | undefined;
  replyStatus?: ReplyStatus | undefined;
  replyType: ReplyType;
  sourceLinks?: SourceLink[];
  sourceTool?: NotchPacket['sourceTool']['name'] | undefined;
  summary: string;
  tags?: string[] | undefined;
  title?: string | undefined;
  toAgent?: string | undefined;
  toPerson?: string | undefined;
  toRepo?: string | undefined;
};

export async function createPacket(
  context: LoadedConfig,
  input: CreatePacketInput,
): Promise<{ packet: NotchPacket; outboxPath: string; outputPath?: string; warnings: NotchError[] }> {
  const purpose = input.purpose ?? 'handoff';
  const sensitivity = input.sensitivity ?? (purpose === 'seed' ? 'private' : 'project');
  const requireRecipient = input.requireRecipient ?? true;
  const warnings: NotchError[] = [];

  if (requireRecipient && purpose === 'handoff' && !input.toAgent && !input.toPerson && !input.toRepo) {
    throw new NotchException({
      code: 'NOTCH_RECORD_INVALID',
      message: 'Handoff packets require at least one recipient.',
      recovery: 'Pass --to-agent, --to-person, or --to-repo.',
      severity: 'error',
      exitCode: 1,
    });
  }

  if (input.replyTo && !input.replyType) {
    throw new NotchException({
      code: 'NOTCH_RECORD_INVALID',
      message: 'Reply packets require a reply type.',
      recovery: 'Pass --type question, clarification, counter-decision, objection, or confirmation.',
      severity: 'error',
      exitCode: 1,
    });
  }

  for (const link of input.sourceLinks ?? []) {
    if (link.kind === 'file' && link.path) {
      const safe = assertSafeRelativePath(link.path, context.config.project.root);
      assertNotStoreRelativePath(safe.relativePath, link.path);
    }
  }

  if ((input.summary.length > 5000) && (input.includedRecords?.length ?? 0) === 0 && (input.sourceLinks?.length ?? 0) === 0) {
    warnings.push({
      code: 'NOTCH_SUMMARY_LARGE',
      message: 'Large summaries without source links are harder to review.',
      recovery: 'Add source links or included records.',
      severity: 'warn',
    });
  }

  const created = createRecordMeta({
    ...(input.actor ? { actor: input.actor } : {}),
    ...(input.agent ? { agent: input.agent } : {}),
    cwd: context.projectRoot,
    ...(input.mcp ? { mcp: true } : {}),
    recordType: 'packet',
    ...(input.sourceTool ? { sourceTool: input.sourceTool } : {}),
    tags: input.tags ?? [],
    title: input.title,
  });
  const packet: NotchPacket = {
    ...created.meta,
    recordType: 'packet',
    status: input.replyTo ? input.replyStatus ?? 'open' : created.meta.status,
    title: input.title,
    purpose,
    sensitivity,
    transferStatus: input.destination === 'private-inbox' ? 'imported' : 'outbox',
    origin: {
      projectName: context.config.project.name,
      storePath: context.storePath,
      repoRoot: context.config.project.root,
    },
    recipient: {
      ...(input.toAgent ? { targetAgent: input.toAgent } : {}),
      ...(input.toPerson ? { targetPerson: input.toPerson } : {}),
      ...(input.toRepo ? { targetRepo: input.toRepo } : {}),
    },
    summary: input.summary,
    ...(input.nextSteps ? { nextSteps: input.nextSteps } : {}),
    ...(input.supersedes ? { supersedes: input.supersedes } : {}),
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    ...(input.replyType ? { replyType: input.replyType } : {}),
    includedRecords: input.includedRecords ?? [],
    includedSourceLinks: input.sourceLinks ?? [],
    ...(input.importNotes ? { importNotes: input.importNotes } : {}),
  };
  const directory = input.destination === 'private-inbox'
    ? context.paths.privateInbox
    : sensitivity === 'private' || purpose === 'seed'
      ? context.paths.privateOutbox
      : context.paths.outbox;
  const slug = input.destination === 'private-inbox'
    ? created.filenameBase
    : `${created.filenameBase}-to-${toSlug(input.toAgent ?? input.toPerson ?? input.toRepo ?? 'seed')}`;
  const preparedArtifacts = (input.files ?? []).length > 0
    ? await preparePacketArtifacts(context, {
        actor: packet.createdBy,
        actorNameResolution: created.actorNameResolution,
        actorTypeResolution: created.actorTypeResolution,
        files: input.files ?? [],
        packetId: packet.id,
        sourceTool: packet.sourceTool,
      })
    : undefined;

  if (preparedArtifacts && preparedArtifacts.artifacts.length > 0) {
    packet.artifacts = preparedArtifacts.artifacts;
    warnings.push(...preparedArtifacts.warnings);
  }

  const body = renderPacketBody(packet, input.task);
  const markdown = renderMarkdownRecord(packet, body);
  const packetMarkdownRelativePath = preparedArtifacts && preparedArtifacts.artifacts.length > 0
    ? path.join(path.relative(context.storePath, directory), slug, 'packet.md')
    : path.join(path.relative(context.storePath, directory), `${slug}.md`);

  await assertNoSecretsWithAudit(markdown, context.config, {
    actor: packet.createdBy,
    actorNameResolution: created.actorNameResolution,
    actorTypeResolution: created.actorTypeResolution,
    field: 'packet markdown',
    logsDir: context.paths.logs,
    path: packetMarkdownRelativePath,
    recordId: packet.id,
    recordType: 'packet',
    sourceTool: packet.sourceTool,
  });

  const validation = parseAndValidateRecord<NotchPacket>(markdown);

  if (!validation.ok) {
    throw new NotchException(validation.errors[0] ?? invalidRecordError('Packet failed validation.'));
  }

  const manifest = manifestBundleFile(packet);
  const written = preparedArtifacts && preparedArtifacts.artifacts.length > 0
    ? await writePacketBundleWithCollisionHandling(context.storePath, {
        directory,
        files: [
          ...(manifest ? [manifest] : []),
          ...preparedArtifacts.bundleFiles,
        ],
        packetMarkdown: markdown,
        slug,
      })
    : await writeRecordWithCollisionHandling(context.storePath, {
        content: markdown,
        directory,
        slug,
      });
  let outputPath: string | undefined;

  if (input.outputPath) {
    outputPath = assertSafeRelativePath(input.outputPath, context.projectRoot).absolutePath;
    await atomicWriteFile(outputPath, markdown);
  }

  await appendAuditEntry(context.paths.logs, {
    schemaVersion: '1.0.0',
    at: new Date().toISOString(),
    operation: 'create',
    result: 'success',
    actor: packet.createdBy,
    actorNameResolution: created.actorNameResolution,
    actorTypeResolution: created.actorTypeResolution,
    sourceTool: packet.sourceTool,
    recordType: 'packet',
    recordId: packet.id,
    recordPath: written.relativePath,
    ...(packet.supersedes ? { supersedes: packet.supersedes } : {}),
  });
  await rebuildIndex(context.storePath);

  return {
    packet,
    outboxPath: written.path,
    ...(outputPath ? { outputPath } : {}),
    warnings,
  };
}

export async function createMark(
  context: LoadedConfig,
  input: CreateMarkInput,
): Promise<{ packet: NotchPacket; path: string; warnings: NotchError[] }> {
  const result = await createPacket(context, {
    ...(input.actor ? { actor: input.actor } : {}),
    ...(input.agent ? { agent: input.agent } : {}),
    destination: 'private-inbox',
    importNotes: 'Self-addressed permanent capture.',
    ...(input.mcp ? { mcp: true } : {}),
    purpose: 'seed',
    requireRecipient: false,
    sensitivity: 'private',
    sourceLinks: input.sourceLinks ?? [],
    ...(input.sourceTool ? { sourceTool: input.sourceTool } : {}),
    summary: input.summary,
    ...(input.supersedes ? { supersedes: input.supersedes } : {}),
    tags: input.tags ?? [],
    title: input.title ?? titleFromSummary(input.summary),
  });

  return { packet: result.packet, path: result.outboxPath, warnings: result.warnings };
}

export async function createReply(
  context: LoadedConfig,
  input: CreateReplyInput,
): Promise<{ packet: NotchPacket; path: string; warnings: NotchError[] }> {
  const parent = await findRecordById(context, input.parentId);
  const parentPacket = parent.record.metadata.recordType === 'packet'
    ? parent.record.metadata as NotchPacket
    : undefined;
  const parentIsOutbox = isOutboxPath(parent.relativePath);
  const destination = parentIsOutbox ? 'outbox' : 'private-inbox';
  const toAgent = input.toAgent ?? parentPacket?.recipient.targetAgent;
  const toPerson = input.toPerson ?? parentPacket?.recipient.targetPerson;
  const toRepo = input.toRepo ?? parentPacket?.recipient.targetRepo;
  const privateReply = input.private || destination === 'private-inbox';
  const result = await createPacket(context, {
    ...(input.actor ? { actor: input.actor } : {}),
    ...(input.agent ? { agent: input.agent } : {}),
    destination,
    files: input.files ?? [],
    importNotes: `Reply to ${input.parentId}.`,
    ...(input.mcp ? { mcp: true } : {}),
    ...(input.nextSteps ? { nextSteps: input.nextSteps } : {}),
    purpose: destination === 'private-inbox' ? 'seed' : 'handoff',
    replyStatus: input.replyStatus ?? 'open',
    replyTo: input.parentId,
    replyType: input.replyType,
    requireRecipient: destination === 'outbox',
    sensitivity: privateReply ? 'private' : parentPacket?.sensitivity ?? 'project',
    sourceLinks: input.sourceLinks ?? [],
    ...(input.sourceTool ? { sourceTool: input.sourceTool } : {}),
    summary: input.summary,
    tags: input.tags ?? [],
    title: input.title ?? `Reply to ${parentTitle(parent.record.metadata)}`,
    ...(toAgent ? { toAgent } : {}),
    ...(toPerson ? { toPerson } : {}),
    ...(toRepo ? { toRepo } : {}),
  });

  return { packet: result.packet, path: result.outboxPath, warnings: result.warnings };
}

export async function listPackets(
  context: LoadedConfig,
  filters: {
    direction?: 'inbox' | 'outbox' | 'both' | undefined;
    includePrivate?: boolean | undefined;
    limit?: number | undefined;
    purpose?: PacketPurpose | undefined;
  } = {},
): Promise<Array<{ direction: 'inbox' | 'outbox'; markdownPath: string; packet: NotchPacket; path: string; rootPath: string }>> {
  const records = await scanMarkdownRecords(context.storePath, {
    ...(filters.includePrivate === undefined ? {} : { includePrivate: filters.includePrivate }),
  });
  const direction = filters.direction ?? 'both';

  return records
    .filter(isValidScannedRecord)
    .filter((record) => record.record.metadata.recordType === 'packet')
    .map((record) => ({
      direction: record.relativePath.includes('/outbox/') || record.relativePath.startsWith('outbox/') ? 'outbox' as const : 'inbox' as const,
      markdownPath: record.path,
      packet: record.record.metadata as NotchPacket,
      path: record.path,
      rootPath: packetRootPath(record.path),
    }))
    .filter((entry) => direction === 'both' || entry.direction === direction)
    .filter((entry) => !filters.purpose || entry.packet.purpose === filters.purpose)
    .sort((a, b) => b.packet.createdAt.localeCompare(a.packet.createdAt))
    .slice(0, filters.limit ?? 50);
}

export async function getPacket(
  context: LoadedConfig,
  idOrSlug: string,
  options: { direction?: 'inbox' | 'outbox' | 'both'; includePrivate?: boolean } = {},
): Promise<{ direction: 'inbox' | 'outbox'; markdown: string; markdownPath: string; packet: NotchPacket; path: string; rootPath: string; rootRelativePath: string }> {
  const packets = await listPackets(context, {
    ...(options.direction ? { direction: options.direction } : {}),
    ...(options.includePrivate === undefined ? {} : { includePrivate: options.includePrivate }),
    limit: 1000,
  });
  const matches = packets.filter((entry) => {
    const stem = packetSlugFromMarkdownPath(entry.markdownPath);
    return entry.packet.id === idOrSlug || stem === idOrSlug;
  });

  if (matches.length === 0) {
    throw new NotchException({
      code: 'NOTCH_RECORD_NOT_FOUND',
      message: `No packet matched ${idOrSlug}.`,
      recovery: 'Run notch packet list to find packet IDs.',
      severity: 'error',
      exitCode: 1,
    });
  }

  if (matches.length > 1) {
    throw new NotchException({
      code: 'NOTCH_RECORD_ID_AMBIGUOUS',
      message: `More than one packet matched ${idOrSlug}.`,
      recovery: 'Use the full packet ID or filename stem.',
      severity: 'error',
      exitCode: 1,
    });
  }

  const match = matches[0];

  if (!match) {
    throw new NotchException(invalidRecordError('Packet lookup failed.'));
  }

  return {
    ...match,
    markdown: await readFile(match.markdownPath, 'utf8'),
    rootRelativePath: toStoreRelativePath(context.storePath, match.rootPath),
  };
}

export function renderPacketBody(packet: NotchPacket, task?: string): string {
  const baseBody = `## Summary

${packet.summary}
${packet.nextSteps ? `
## Next Steps

${packet.nextSteps}
` : ''}

## Recipient

${packet.recipient.targetAgent ?? packet.recipient.targetPerson ?? packet.recipient.targetRepo ?? (packet.replyTo ? `Reply to ${packet.replyTo}.` : 'Private seed packet.')}

## Origin

${packet.origin.projectName} (${packet.origin.storePath})

## Included Context

${packet.includedRecords.map((record) => `- ${record.recordType}:${record.id} - ${record.title}`).join('\n') || '- None.'}
${task ? `\nTask: ${task}` : ''}

## Source Links

${packet.includedSourceLinks.map((link) => `- ${link.path ?? link.url ?? link.recordId ?? link.kind}`).join('\n') || '- None.'}

## Import Notes

${packet.importNotes ?? 'Review before use.'}
`;

  if (packet.purpose !== 'seed') {
    return baseBody;
  }

  return `${baseBody}
## User Preferences

${packet.privateContextSummary ?? packet.summary}

## Workflow Conventions

- Review private seed context before relying on it.

## Lessons From Prior Work

- Carry forward only explicitly reviewed context.

## What Not To Carry Forward

- Hidden chat history or unreviewed private data.
`;
}

function invalidRecordError(message: string): NotchError {
  return {
    code: 'NOTCH_RECORD_INVALID',
    message,
    recovery: 'Fix generated record fields before writing.',
    severity: 'error',
    exitCode: 1,
  };
}

function titleFromSummary(summary: string): string {
  const firstLine = summary
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  return (firstLine ?? 'Untitled mark').slice(0, 80);
}

async function findRecordById(context: LoadedConfig, id: string): Promise<ValidScannedRecord> {
  const records = await scanMarkdownRecords(context.storePath, { includePrivate: true });
  const matches = records
    .filter(isValidScannedRecord)
    .filter((record) => record.record.metadata.id === id);

  if (matches.length === 0) {
    throw new NotchException({
      code: 'NOTCH_RECORD_NOT_FOUND',
      message: `No record matched ${id}.`,
      recovery: 'Run notch packet list or notch brief list to find record IDs.',
      severity: 'error',
      exitCode: 1,
    });
  }

  if (matches.length > 1) {
    throw new NotchException({
      code: 'NOTCH_RECORD_ID_AMBIGUOUS',
      message: `More than one record matched ${id}.`,
      recovery: 'Reply to a record ID that is unique in this store.',
      severity: 'error',
      exitCode: 1,
    });
  }

  const match = matches[0];

  if (!match) {
    throw new NotchException(invalidRecordError('Record lookup failed.'));
  }

  return match;
}

function isOutboxPath(relativePath: string): boolean {
  return relativePath.startsWith('outbox/') || relativePath.startsWith('private/outbox/');
}

function assertNotStoreRelativePath(relativePath: string, originalPath: string): void {
  if (relativePath === '.notch' || relativePath.startsWith('.notch/')) {
    throw new NotchException({
      code: 'NOTCH_ARTIFACT_PATH_INVALID',
      message: 'Packet references cannot point inside the .notch store.',
      path: originalPath,
      recovery: 'Reference project source files, not 3Notch store internals.',
      severity: 'error',
      exitCode: 5,
    });
  }
}

function parentTitle(metadata: Record<string, unknown>): string {
  if (typeof metadata.title === 'string') {
    return metadata.title.slice(0, 80);
  }

  if (typeof metadata.projectName === 'string') {
    return metadata.projectName.slice(0, 80);
  }

  return String(metadata.id ?? 'record').slice(0, 80);
}
