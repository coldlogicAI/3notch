import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { isValidScannedRecord, scanMarkdownRecords, type ValidScannedRecord } from './store-service.js';
import type { NotchPacket, SourceLink } from '../types/records.js';

export type RelationshipEdgeType =
  | 'supersedes'
  | 'replyTo'
  | 'co-tagged'
  | 'co-recipient'
  | 'co-source-link';

export type RelationshipEdge = {
  type: RelationshipEdgeType;
  from: string;
  to: string;
  metadata?: Record<string, unknown>;
};

export type RelationshipsIndex = {
  schemaVersion: '1.0.0';
  generatedAt: string;
  edges: RelationshipEdge[];
};

type PacketEntry = {
  packet: NotchPacket;
  relativePath: string;
};

export async function rebuildRelationshipsIndex(storePath: string, includePrivate = true): Promise<RelationshipsIndex> {
  const scanned = await scanMarkdownRecords(storePath, { includePrivate });
  const index = buildRelationshipsIndex(scanned.filter(isValidScannedRecord));

  await mkdir(path.join(storePath, 'index'), { recursive: true });
  await writeFile(path.join(storePath, 'index/relationships.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');

  return index;
}

export function buildRelationshipsIndex(records: ValidScannedRecord[]): RelationshipsIndex {
  const packets = records
    .filter((record) => record.record.metadata.recordType === 'packet')
    .map((record) => ({
      packet: record.record.metadata as NotchPacket,
      relativePath: record.relativePath,
    }))
    .sort((a, b) => a.packet.id.localeCompare(b.packet.id));
  const edges: RelationshipEdge[] = [];

  for (const entry of packets) {
    if (entry.packet.supersedes) {
      edges.push({
        type: 'supersedes',
        from: entry.packet.id,
        to: entry.packet.supersedes,
      });
    }

    if (entry.packet.replyTo) {
      edges.push({
        type: 'replyTo',
        from: entry.packet.id,
        to: entry.packet.replyTo,
        ...(entry.packet.replyType || isReplyStatus(entry.packet.status)
          ? {
              metadata: {
                ...(entry.packet.replyType ? { replyType: entry.packet.replyType } : {}),
                ...(isReplyStatus(entry.packet.status) ? { status: entry.packet.status } : {}),
              },
            }
          : {}),
      });
    }
  }

  for (let index = 0; index < packets.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < packets.length; otherIndex += 1) {
      const left = packets[index];
      const right = packets[otherIndex];

      if (!left || !right) {
        continue;
      }

      const coTagged = sharedValues(left.packet.tags, right.packet.tags);

      if (coTagged.length >= 2) {
        edges.push(undirectedEdge('co-tagged', left.packet.id, right.packet.id, { tags: coTagged }));
      }

      const sharedSources = sharedValues(sourceKeys(left.packet), sourceKeys(right.packet));

      if (sharedSources.length > 0) {
        edges.push(undirectedEdge('co-source-link', left.packet.id, right.packet.id, { sources: sharedSources }));
      }

      const leftRecipient = recipientKey(left.packet);
      const rightRecipient = recipientKey(right.packet);

      if (leftRecipient && leftRecipient === rightRecipient && senderKey(left.packet) === senderKey(right.packet)) {
        const ordered = [left, right].sort(comparePacketThreadOrder);
        const from = ordered[0];
        const to = ordered[1];

        if (from && to) {
          edges.push({
            type: 'co-recipient',
            from: from.packet.id,
            to: to.packet.id,
            metadata: {
              recipient: leftRecipient,
              sender: senderKey(left.packet),
            },
          });
        }
      }
    }
  }

  return {
    schemaVersion: '1.0.0',
    generatedAt: generatedAtFor(records),
    edges: sortEdges(dedupeEdges(edges)),
  };
}

function undirectedEdge(
  type: Extract<RelationshipEdgeType, 'co-tagged' | 'co-source-link'>,
  left: string,
  right: string,
  metadata: Record<string, unknown>,
): RelationshipEdge {
  const [from, to] = [left, right].sort();

  return { type, from: from ?? left, to: to ?? right, metadata };
}

function sharedValues(left: string[] | undefined, right: string[] | undefined): string[] {
  const rightValues = new Set(right ?? []);

  return [...new Set(left ?? [])].filter((value) => rightValues.has(value)).sort();
}

function sourceKeys(packet: NotchPacket): string[] {
  return [...(packet.sourceLinks ?? []), ...(packet.includedSourceLinks ?? [])]
    .map(sourceKey)
    .filter((value): value is string => Boolean(value))
    .sort();
}

function sourceKey(link: SourceLink): string | undefined {
  if (link.kind === 'file' && link.path) {
    return `file:${link.path}`;
  }

  if (link.kind === 'url' && link.url) {
    return `url:${link.url}`;
  }

  return undefined;
}

function recipientKey(packet: NotchPacket): string | undefined {
  const recipient = packet.recipient.targetAgent
    ?? packet.recipient.targetPerson
    ?? packet.recipient.targetRepo
    ?? packet.recipient.targetStore;

  return recipient ? `${recipientKind(packet)}:${recipient}` : undefined;
}

function recipientKind(packet: NotchPacket): string {
  if (packet.recipient.targetAgent) {
    return 'agent';
  }

  if (packet.recipient.targetPerson) {
    return 'person';
  }

  if (packet.recipient.targetRepo) {
    return 'repo';
  }

  return 'store';
}

function senderKey(packet: NotchPacket): string {
  return `${packet.origin.projectName}:${packet.origin.storePath}`;
}

function comparePacketThreadOrder(left: PacketEntry, right: PacketEntry): number {
  const leftTime = left.packet.importedAt ?? left.packet.createdAt;
  const rightTime = right.packet.importedAt ?? right.packet.createdAt;
  const byTime = leftTime.localeCompare(rightTime);

  return byTime === 0 ? left.packet.id.localeCompare(right.packet.id) : byTime;
}

function dedupeEdges(edges: RelationshipEdge[]): RelationshipEdge[] {
  const seen = new Set<string>();
  const deduped: RelationshipEdge[] = [];

  for (const edge of edges) {
    const key = JSON.stringify(edge);

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(edge);
    }
  }

  return deduped;
}

function sortEdges(edges: RelationshipEdge[]): RelationshipEdge[] {
  return [...edges].sort((left, right) => {
    const fields = [
      left.type.localeCompare(right.type),
      left.from.localeCompare(right.from),
      left.to.localeCompare(right.to),
      JSON.stringify(left.metadata ?? {}).localeCompare(JSON.stringify(right.metadata ?? {})),
    ];

    return fields.find((value) => value !== 0) ?? 0;
  });
}

function generatedAtFor(records: ValidScannedRecord[]): string {
  const timestamps = records
    .map((record) => record.record.metadata)
    .flatMap((metadata) => [metadata.updatedAt, metadata.importedAt, metadata.createdAt])
    .filter((value): value is string => typeof value === 'string')
    .sort();

  return timestamps.at(-1) ?? '1970-01-01T00:00:00.000Z';
}

function isReplyStatus(value: string): boolean {
  return value === 'open' || value === 'resolved' || value === 'dismissed';
}
