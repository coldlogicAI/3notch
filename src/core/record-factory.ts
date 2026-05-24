import { createDatedFilename, createRecordId, toSlug } from './id-service.js';
import { resolveActor, type ResolveActorOptions } from './actor-service.js';
import type { RecordMeta, RecordStatus, RecordType, ReviewStatus } from '../types/records.js';

export type CreateRecordMetaOptions = ResolveActorOptions & {
  date?: Date;
  recordType: RecordType;
  status?: RecordStatus;
  tags?: string[];
  title: string;
};

export type CreatedRecordMeta = {
  filenameBase: string;
  meta: RecordMeta;
  slug: string;
};

export function createRecordMeta(options: CreateRecordMetaOptions): CreatedRecordMeta {
  const date = options.date ?? new Date();
  const actor = resolveActor(options);
  const reviewStatus: ReviewStatus = actor.actor.actorType === 'agent' ? 'unreviewed' : 'reviewed';
  const slug = toSlug(options.title);
  const idPrefix = options.recordType === 'project_brief' ? 'project_brief' : options.recordType;

  return {
    filenameBase: createDatedFilename(options.title, '', date),
    meta: {
      id: createRecordId(idPrefix, options.title, date),
      schemaVersion: '1.0.0',
      recordType: options.recordType,
      status: options.status ?? 'active',
      createdAt: date.toISOString(),
      createdBy: actor.actor,
      sourceTool: actor.sourceTool,
      tags: normalizeTags(options.tags ?? []),
      sourceLinks: [],
      reviewStatus,
    },
    slug,
  };
}

export function normalizeTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => toSlug(tag)).filter(Boolean))];
}
