import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { readFile, stat } from 'node:fs/promises';

import { appendAuditEntry } from './audit-service.js';
import { parseAndValidateRecord } from './record-parser.js';
import { resolveActor } from './actor-service.js';
import { assertNoSecretsWithAudit } from './secret-scan-service.js';
import { rebuildIndex } from './index-service.js';
import { isValidScannedRecord, renderMarkdownRecord, scanMarkdownRecords, writeRecordWithCollisionHandling } from './store-service.js';
import { createDatedFilename, toSlug } from './id-service.js';
import { NotchException } from '../types/errors.js';
import type { LoadedConfig } from './config-service.js';
import type { NotchPacket, SourceTool } from '../types/records.js';

export async function importPacketFile(
  context: LoadedConfig,
  packetPath: string,
  options: {
    actor?: string;
    agent?: string;
    asReviewed?: boolean;
    forcePrivate?: boolean;
    mcp?: boolean;
    seedOnly?: boolean;
    sourceTool?: SourceTool['name'];
  } = {},
): Promise<{ inboxPath: string; packet: NotchPacket }> {
  const markdown = await readFile(packetPath, 'utf8');

  return await importPacketMarkdown(context, markdown, packetPath, options);
}

export async function importPacketMarkdown(
  context: LoadedConfig,
  markdown: string,
  importedFrom: string,
  options: {
    actor?: string;
    agent?: string;
    asReviewed?: boolean;
    forcePrivate?: boolean;
    mcp?: boolean;
    seedOnly?: boolean;
    sourceTool?: SourceTool['name'];
  } = {},
): Promise<{ inboxPath: string; packet: NotchPacket }> {
  const parsed = parseAndValidateRecord<NotchPacket>(markdown, importedFrom);

  if (!parsed.ok) {
    throw new NotchException({
      ...parsed.errors[0],
      code: parsed.errors[0]?.code ?? 'NOTCH_RECORD_INVALID',
      message: parsed.errors[0]?.message ?? 'Packet is invalid.',
      severity: 'error',
      exitCode: 3,
    });
  }

  const packet = parsed.data;
  await assertImportedReferencesExist(context, packet);

  if (options.seedOnly && packet.purpose !== 'seed') {
    throw new NotchException({
      code: 'NOTCH_RECORD_INVALID',
      message: 'Seed imports require a packet with purpose: seed.',
      recovery: 'Use notch packet import for project handoff packets.',
      severity: 'error',
      exitCode: 1,
    });
  }

  const imported: NotchPacket = {
    ...packet,
    transferStatus: 'imported',
    importedAt: new Date().toISOString(),
    importedFrom: basename(importedFrom),
    ...(options.asReviewed ? { reviewStatus: 'reviewed' } : {}),
  };
  const body = parsed.body ?? '';
  const rendered = renderMarkdownRecord(imported, body);
  const importer = resolveActor({
    ...(options.actor ? { actor: options.actor } : {}),
    ...(options.agent ? { agent: options.agent } : {}),
    cwd: context.projectRoot,
    ...(options.mcp ? { mcp: true } : {}),
    ...(options.sourceTool ? { sourceTool: options.sourceTool } : {}),
  });
  await assertNoSecretsWithAudit(rendered, context.config, {
    actor: importer.actor,
    actorNameResolution: importer.actorNameResolution,
    actorTypeResolution: importer.actorTypeResolution,
    field: 'imported packet markdown',
    logsDir: context.paths.logs,
    path: importedFrom,
    recordId: imported.id,
    recordType: 'packet',
    sourceTool: importer.sourceTool,
  });
  const privateImport = options.forcePrivate || imported.sensitivity === 'private' || imported.purpose === 'seed';
  const directory = privateImport ? context.paths.privateInbox : context.paths.inbox;
  const from = toSlug(imported.origin.projectName);
  const slug = privateImport
    ? createDatedFilename(`${imported.title}-seed-from-${from}`, '', new Date())
    : createDatedFilename(`${imported.title}-from-${from}`, '', new Date());
  const written = await writeRecordWithCollisionHandling(context.storePath, {
    content: rendered,
    directory,
    slug,
  });
  await assertImmutableRecordDestination(written.path, rendered);

  await appendAuditEntry(context.paths.logs, {
    schemaVersion: '1.0.0',
    at: new Date().toISOString(),
    operation: 'import',
    result: 'success',
    actor: importer.actor,
    actorNameResolution: importer.actorNameResolution,
    actorTypeResolution: importer.actorTypeResolution,
    sourceTool: importer.sourceTool,
    recordType: 'packet',
    recordId: imported.id,
    recordPath: written.relativePath,
    importedFrom,
    ...(imported.supersedes ? { supersedes: imported.supersedes } : {}),
  });
  await rebuildIndex(context.storePath);

  return { inboxPath: written.path, packet: imported };
}

export async function assertImmutableRecordDestination(filePath: string, nextContent: string): Promise<void> {
  try {
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      return;
    }
  } catch {
    return;
  }

  const current = await readFile(filePath, 'utf8');

  if (sha256(current) !== sha256(nextContent)) {
    throw new NotchException({
      code: 'NOTCH_RECORD_IMMUTABLE',
      message: `Refusing to overwrite existing imported packet: ${filePath}`,
      path: filePath,
      recovery: 'Import the packet as a new file; received packets are immutable ground truth.',
      severity: 'error',
      exitCode: 6,
    });
  }
}

async function assertImportedReferencesExist(context: LoadedConfig, packet: NotchPacket): Promise<void> {
  const references = [packet.supersedes, packet.replyTo].filter((value): value is string => Boolean(value));

  if (references.length === 0) {
    return;
  }

  const records = await scanMarkdownRecords(context.storePath, { includePrivate: true });
  const existingIds = new Set(
    records
      .filter(isValidScannedRecord)
      .map((record) => record.record.metadata.id)
      .filter((value): value is string => typeof value === 'string'),
  );
  const missing = references.find((reference) => !existingIds.has(reference));

  if (missing) {
    throw new NotchException({
      code: 'NOTCH_RECORD_NOT_FOUND',
      message: `Imported packet references a record that is not in this store: ${missing}`,
      recovery: 'Import the referenced packet first, or remove the relationship field before importing.',
      severity: 'error',
      exitCode: 1,
    });
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
