import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { scanMarkdownRecords } from './store-service.js';
import type { NotchBrief, NotchPacket, ProjectBrief } from '../types/records.js';

export type IndexedRecord = {
  createdAt?: string;
  direction?: 'briefs' | 'inbox' | 'outbox' | 'private/inbox' | 'private/outbox' | 'root';
  id: string;
  path: string;
  purpose?: string;
  recordType: string;
  sensitivity?: string;
  status?: string;
  summary?: string;
  tags: string[];
  targetAgent?: string;
  title?: string;
};

export type RecordsIndex = {
  generatedAt: string;
  records: IndexedRecord[];
  schemaVersion: '1.0.0';
};

export type IndexManifest = {
  generatedAt: string;
  recordCount: number;
  schemaVersion: '1.0.0';
  source: 'file-scan';
};

export async function rebuildIndex(storePath: string, includePrivate = true): Promise<{
  manifest: IndexManifest;
  records: RecordsIndex;
}> {
  const scanned = await scanMarkdownRecords(storePath, { includePrivate });
  const generatedAt = new Date().toISOString();
  const records: RecordsIndex = {
    generatedAt,
    records: scanned
      .filter((record) => record.ok)
      .map((record) => indexedRecord(record.record.metadata, record.relativePath)),
    schemaVersion: '1.0.0',
  };
  const manifest: IndexManifest = {
    generatedAt,
    recordCount: records.records.length,
    schemaVersion: '1.0.0',
    source: 'file-scan',
  };

  await mkdir(path.join(storePath, 'index'), { recursive: true });
  await writeFile(path.join(storePath, 'index/records.json'), `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  await writeFile(path.join(storePath, 'index/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return { manifest, records };
}

function indexedRecord(
  metadata: Record<string, unknown>,
  relativePath: string,
): IndexedRecord {
  const recordType = String(metadata.recordType);
  const packet = metadata as Partial<NotchPacket>;
  const brief = metadata as Partial<NotchBrief>;
  const projectBrief = metadata as Partial<ProjectBrief>;

  return {
    ...(typeof metadata.createdAt === 'string' ? { createdAt: metadata.createdAt } : {}),
    direction: directionForPath(relativePath),
    id: String(metadata.id),
    path: relativePath,
    ...(typeof packet.purpose === 'string' ? { purpose: packet.purpose } : {}),
    recordType,
    ...(typeof packet.sensitivity === 'string' ? { sensitivity: packet.sensitivity } : {}),
    ...(typeof metadata.status === 'string' ? { status: metadata.status } : {}),
    ...(typeof packet.summary === 'string' ? { summary: packet.summary } : {}),
    tags: Array.isArray(metadata.tags) ? metadata.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    ...(typeof brief.targetAgent === 'string'
      ? { targetAgent: brief.targetAgent }
      : typeof packet.recipient?.targetAgent === 'string'
        ? { targetAgent: packet.recipient.targetAgent }
        : {}),
    ...(typeof brief.title === 'string'
      ? { title: brief.title }
      : typeof packet.title === 'string'
        ? { title: packet.title }
        : typeof projectBrief.projectName === 'string'
          ? { title: projectBrief.projectName }
          : {}),
  };
}

function directionForPath(relativePath: string): NonNullable<IndexedRecord['direction']> {
  if (relativePath.startsWith('briefs/')) {
    return 'briefs';
  }

  if (relativePath.startsWith('private/inbox/')) {
    return 'private/inbox';
  }

  if (relativePath.startsWith('private/outbox/')) {
    return 'private/outbox';
  }

  if (relativePath.startsWith('inbox/')) {
    return 'inbox';
  }

  if (relativePath.startsWith('outbox/')) {
    return 'outbox';
  }

  return 'root';
}
