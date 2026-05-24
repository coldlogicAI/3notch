import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { appendAuditEntry } from './audit-service.js';
import { assertSafeRelativePath } from './path-safety.js';
import { createRecordMeta } from './record-factory.js';
import { parseAndValidateRecord } from './record-parser.js';
import { assertNoSecretsWithAudit } from './secret-scan-service.js';
import { rebuildIndex } from './index-service.js';
import { atomicWriteFile, isValidScannedRecord, renderMarkdownRecord, scanMarkdownRecords, writeRecordWithCollisionHandling } from './store-service.js';
import { toSlug } from './id-service.js';
import { NotchException, type NotchError } from '../types/errors.js';
import type { LoadedConfig } from './config-service.js';
import type { NotchPacket, PacketPurpose, PacketRecordRef, Sensitivity, SourceLink } from '../types/records.js';

export type CreatePacketInput = {
  actor?: string | undefined;
  agent?: string | undefined;
  includedRecords?: PacketRecordRef[];
  importNotes?: string | undefined;
  outputPath?: string | undefined;
  purpose?: PacketPurpose | undefined;
  sensitivity?: Sensitivity | undefined;
  sourceLinks?: SourceLink[];
  sourceTool?: NotchPacket['sourceTool']['name'] | undefined;
  summary: string;
  task?: string | undefined;
  title: string;
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
  const warnings: NotchError[] = [];

  if (purpose === 'handoff' && !input.toAgent && !input.toPerson && !input.toRepo) {
    throw new NotchException({
      code: 'NOTCH_RECORD_INVALID',
      message: 'Handoff packets require at least one recipient.',
      recovery: 'Pass --to-agent, --to-person, or --to-repo.',
      severity: 'error',
      exitCode: 1,
    });
  }

  for (const link of input.sourceLinks ?? []) {
    if (link.kind === 'file' && link.path) {
      assertSafeRelativePath(link.path, context.config.project.root);
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
    recordType: 'packet',
    ...(input.sourceTool ? { sourceTool: input.sourceTool } : {}),
    title: input.title,
  });
  const packet: NotchPacket = {
    ...created.meta,
    recordType: 'packet',
    title: input.title,
    purpose,
    sensitivity,
    transferStatus: sensitivity === 'private' || purpose === 'seed' ? 'outbox' : 'outbox',
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
    includedRecords: input.includedRecords ?? [],
    includedSourceLinks: input.sourceLinks ?? [],
    ...(input.importNotes ? { importNotes: input.importNotes } : {}),
  };
  const body = renderPacketBody(packet, input.task);
  const markdown = renderMarkdownRecord(packet, body);
  const directory = sensitivity === 'private' || purpose === 'seed' ? context.paths.privateOutbox : context.paths.outbox;
  const slug = `${created.filenameBase}-to-${toSlug(input.toAgent ?? input.toPerson ?? input.toRepo ?? 'seed')}`;

  await assertNoSecretsWithAudit(markdown, context.config, {
    actor: packet.createdBy,
    actorNameResolution: 'cli-flag',
    actorTypeResolution: packet.createdBy.actorType === 'agent' ? 'cli-agent-flag' : 'cli-default',
    logsDir: context.paths.logs,
    recordId: packet.id,
    recordType: 'packet',
    sourceTool: packet.sourceTool,
  });

  const validation = parseAndValidateRecord<NotchPacket>(markdown);

  if (!validation.ok) {
    throw new NotchException(validation.errors[0] ?? invalidRecordError('Packet failed validation.'));
  }

  const written = await writeRecordWithCollisionHandling(context.storePath, {
    content: markdown,
    directory,
    slug,
  });
  let outputPath: string | undefined;

  if (input.outputPath) {
    outputPath = path.resolve(context.projectRoot, input.outputPath);
    await atomicWriteFile(outputPath, markdown);
  }

  await appendAuditEntry(context.paths.logs, {
    schemaVersion: '1.0.0',
    at: new Date().toISOString(),
    operation: 'create',
    result: 'success',
    actor: packet.createdBy,
    actorNameResolution: 'cli-flag',
    actorTypeResolution: packet.createdBy.actorType === 'agent' ? 'cli-agent-flag' : 'cli-default',
    sourceTool: packet.sourceTool,
    recordType: 'packet',
    recordId: packet.id,
    recordPath: written.relativePath,
  });
  await rebuildIndex(context.storePath);

  return {
    packet,
    outboxPath: written.path,
    ...(outputPath ? { outputPath } : {}),
    warnings,
  };
}

export async function listPackets(
  context: LoadedConfig,
  filters: {
    direction?: 'inbox' | 'outbox' | 'both' | undefined;
    includePrivate?: boolean | undefined;
    limit?: number | undefined;
    purpose?: PacketPurpose | undefined;
  } = {},
): Promise<Array<{ direction: 'inbox' | 'outbox'; packet: NotchPacket; path: string }>> {
  const records = await scanMarkdownRecords(context.storePath, {
    ...(filters.includePrivate === undefined ? {} : { includePrivate: filters.includePrivate }),
  });
  const direction = filters.direction ?? 'both';

  return records
    .filter(isValidScannedRecord)
    .filter((record) => record.record.metadata.recordType === 'packet')
    .map((record) => ({
      direction: record.relativePath.includes('/outbox/') || record.relativePath.startsWith('outbox/') ? 'outbox' as const : 'inbox' as const,
      packet: record.record.metadata as NotchPacket,
      path: record.path,
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
): Promise<{ direction: 'inbox' | 'outbox'; markdown: string; packet: NotchPacket; path: string }> {
  const packets = await listPackets(context, {
    ...(options.direction ? { direction: options.direction } : {}),
    ...(options.includePrivate === undefined ? {} : { includePrivate: options.includePrivate }),
    limit: 1000,
  });
  const matches = packets.filter((entry) => {
    const stem = path.basename(entry.path, '.md');
    return entry.packet.id === idOrSlug || stem === idOrSlug || stem.includes(idOrSlug);
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
    markdown: await readFile(match.path, 'utf8'),
  };
}

export function renderPacketBody(packet: NotchPacket, task?: string): string {
  const baseBody = `## Summary

${packet.summary}

## Recipient

${packet.recipient.targetAgent ?? packet.recipient.targetPerson ?? packet.recipient.targetRepo ?? 'Private seed packet.'}

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
