import { basename } from 'node:path';
import { readFile } from 'node:fs/promises';

import { appendAuditEntry } from './audit-service.js';
import { parseAndValidateRecord } from './record-parser.js';
import { assertNoSecretsWithAudit } from './secret-scan-service.js';
import { rebuildIndex } from './index-service.js';
import { renderMarkdownRecord, writeRecordWithCollisionHandling } from './store-service.js';
import { createDatedFilename, toSlug } from './id-service.js';
import { NotchException } from '../types/errors.js';
import type { LoadedConfig } from './config-service.js';
import type { NotchPacket } from '../types/records.js';

export async function importPacketFile(
  context: LoadedConfig,
  packetPath: string,
  options: { asReviewed?: boolean; forcePrivate?: boolean; seedOnly?: boolean } = {},
): Promise<{ inboxPath: string; packet: NotchPacket }> {
  const markdown = await readFile(packetPath, 'utf8');
  const parsed = parseAndValidateRecord<NotchPacket>(markdown, packetPath);

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
    importedFrom: basename(packetPath),
    ...(options.asReviewed ? { reviewStatus: 'reviewed' } : {}),
  };
  const body = parsed.body ?? '';
  const rendered = renderMarkdownRecord(imported, body);
  await assertNoSecretsWithAudit(rendered, context.config, {
    actor: imported.createdBy,
    actorNameResolution: 'cli-flag',
    actorTypeResolution: imported.createdBy.actorType === 'agent' ? 'cli-agent-flag' : 'cli-default',
    logsDir: context.paths.logs,
    recordId: imported.id,
    recordType: 'packet',
    sourceTool: imported.sourceTool,
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

  await appendAuditEntry(context.paths.logs, {
    schemaVersion: '1.0.0',
    at: new Date().toISOString(),
    operation: 'import',
    result: 'success',
    actor: imported.createdBy,
    actorNameResolution: 'cli-flag',
    actorTypeResolution: imported.createdBy.actorType === 'agent' ? 'cli-agent-flag' : 'cli-default',
    sourceTool: imported.sourceTool,
    recordType: 'packet',
    recordId: imported.id,
    recordPath: written.relativePath,
    importedFrom: packetPath,
  });
  await rebuildIndex(context.storePath);

  return { inboxPath: written.path, packet: imported };
}
