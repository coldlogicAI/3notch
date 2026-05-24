import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { appendAuditEntry } from './audit-service.js';
import { assertSafeRelativePath } from './path-safety.js';
import { createRecordMeta } from './record-factory.js';
import { parseAndValidateRecord } from './record-parser.js';
import { assertNoSecrets } from './secret-scan-service.js';
import { rebuildIndex } from './index-service.js';
import { isValidScannedRecord, renderMarkdownRecord, scanMarkdownRecords, writeRecordWithCollisionHandling } from './store-service.js';
import { toSlug } from './id-service.js';
import { NotchException, type NotchError } from '../types/errors.js';
import type { LoadedConfig } from './config-service.js';
import type { NotchBrief, ProjectBrief, SourceLink, SourceTool } from '../types/records.js';

export type CreateBriefInput = {
  actor?: string;
  agent?: string;
  constraints?: string[];
  designBasis: string;
  exclusions: string[];
  goal: string;
  priorReasoningSummary: string;
  recommendedNextSteps?: string[];
  relevantFiles?: SourceLink[];
  scope: {
    files: string[];
    timeframe?: string;
    topics: string[];
  };
  slug?: string;
  sourceTool?: SourceTool['name'];
  tags?: string[];
  targetAgent: string;
  title: string;
};

export async function getProjectBrief(context: LoadedConfig): Promise<{
  body: string;
  brief: ProjectBrief;
  markdown: string;
  warnings: NotchError[];
}> {
  const markdown = await readFile(context.paths.brief, 'utf8');
  const parsed = parseAndValidateRecord<ProjectBrief>(markdown, context.paths.brief);

  if (!parsed.ok) {
    throw new NotchException({
      ...parsed.errors[0],
      code: parsed.errors[0]?.code ?? 'NOTCH_RECORD_INVALID',
      message: parsed.errors[0]?.message ?? 'Project brief is invalid.',
      severity: 'error',
      exitCode: 3,
    });
  }

  return { body: parsed.body ?? '', brief: parsed.data, markdown, warnings: parsed.warnings };
}

export async function createTargetedBrief(
  context: LoadedConfig,
  input: CreateBriefInput,
): Promise<{ brief: NotchBrief; path: string; warnings: NotchError[] }> {
  for (const file of input.scope.files) {
    assertSafeRelativePath(file, context.config.project.root);
  }

  for (const link of input.relevantFiles ?? []) {
    if (link.kind === 'file' && link.path) {
      assertSafeRelativePath(link.path, context.config.project.root);
    }
  }

  const created = createRecordMeta({
    ...(input.actor ? { actor: input.actor } : {}),
    ...(input.agent ? { agent: input.agent } : {}),
    cwd: context.projectRoot,
    recordType: 'brief',
    ...(input.sourceTool ? { sourceTool: input.sourceTool } : {}),
    ...(input.tags ? { tags: input.tags } : {}),
    title: input.title,
  });
  const brief: NotchBrief = {
    ...created.meta,
    recordType: 'brief',
    title: input.title,
    targetAgent: input.targetAgent,
    goal: input.goal,
    scope: input.scope,
    exclusions: input.exclusions,
    relevantFiles: input.relevantFiles ?? [],
    designBasis: input.designBasis,
    priorReasoningSummary: input.priorReasoningSummary,
    constraints: input.constraints ?? [],
    recommendedNextSteps: input.recommendedNextSteps ?? [],
  };
  const body = renderTargetedBriefBody(brief);
  const markdown = renderMarkdownRecord(brief, body);

  assertNoSecrets(markdown, context.config);

  const validation = parseAndValidateRecord<NotchBrief>(markdown);

  if (!validation.ok) {
    throw new NotchException(validation.errors[0] ?? invalidRecordError('Brief failed validation.'));
  }

  const slug = input.slug ?? `${created.filenameBase}-for-${toSlug(input.targetAgent)}`;
  const written = await writeRecordWithCollisionHandling(context.storePath, {
    content: markdown,
    directory: context.paths.briefs,
    explicitSlug: Boolean(input.slug),
    slug,
  });

  await appendAuditEntry(context.paths.logs, {
    schemaVersion: '1.0.0',
    at: new Date().toISOString(),
    operation: 'create',
    result: 'success',
    actor: brief.createdBy,
    actorNameResolution: 'cli-flag',
    actorTypeResolution: brief.createdBy.actorType === 'agent' ? 'cli-agent-flag' : 'cli-default',
    sourceTool: brief.sourceTool,
    recordType: 'brief',
    recordId: brief.id,
    recordPath: written.relativePath,
  });
  await rebuildIndex(context.storePath);

  return { brief, path: written.path, warnings: [] };
}

export async function listTargetedBriefs(
  context: LoadedConfig,
  filters: { targetAgent?: string; tags?: string[]; status?: string; limit?: number } = {},
): Promise<NotchBrief[]> {
  const records = await scanMarkdownRecords(context.storePath);
  const briefs = records
    .filter(isValidScannedRecord)
    .filter((record) => record.record.metadata.recordType === 'brief')
    .map((record) => record.record.metadata as NotchBrief)
    .filter((brief) => !filters.targetAgent || brief.targetAgent === filters.targetAgent)
    .filter((brief) => !filters.status || brief.status === filters.status)
    .filter((brief) => !filters.tags || filters.tags.every((tag) => brief.tags.includes(toSlug(tag))))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return briefs.slice(0, filters.limit ?? briefs.length);
}

export async function getTargetedBrief(
  context: LoadedConfig,
  idOrSlug: string,
): Promise<{ body: string; brief: NotchBrief; markdown: string; path: string }> {
  const records = await scanMarkdownRecords(context.storePath);
  const matches = records.filter(isValidScannedRecord).filter((record) => {
    if (record.record.metadata.recordType !== 'brief') {
      return false;
    }

    const brief = record.record.metadata as NotchBrief;
    const stem = path.basename(record.path, '.md');
    return brief.id === idOrSlug || stem === idOrSlug || stem.includes(idOrSlug);
  });

  if (matches.length === 0) {
    throw new NotchException({
      code: 'NOTCH_RECORD_NOT_FOUND',
      message: `No targeted brief matched ${idOrSlug}.`,
      recovery: 'Run notch brief list to find available brief IDs.',
      severity: 'error',
      exitCode: 1,
    });
  }

  if (matches.length > 1) {
    throw new NotchException({
      code: 'NOTCH_RECORD_ID_AMBIGUOUS',
      message: `More than one targeted brief matched ${idOrSlug}.`,
      recovery: 'Use the full record ID or filename stem.',
      severity: 'error',
      exitCode: 1,
    });
  }

  const match = matches[0];

  if (!match?.ok) {
    throw new NotchException(invalidRecordError('Targeted brief is invalid.'));
  }

  return {
    body: match.record.body,
    brief: match.record.metadata as NotchBrief,
    markdown: await readFile(match.path, 'utf8'),
    path: match.path,
  };
}

function renderTargetedBriefBody(brief: NotchBrief): string {
  return `## Goal For ${brief.targetAgent}

${brief.goal}

## Relevant Background

${brief.scope.topics.map((topic) => `- ${topic}`).join('\n') || '- None.'}

## Prior Reasoning Summary

${brief.priorReasoningSummary}

## Design Basis

${brief.designBasis}

## Relevant Files And Sources

${[...brief.scope.files, ...brief.relevantFiles.map((file) => file.path ?? file.url ?? file.label ?? file.kind)]
  .map((file) => `- ${file}`)
  .join('\n') || '- None.'}

## Known Pitfalls

${brief.exclusions.map((exclusion) => `- ${exclusion}`).join('\n') || '- None.'}

## Recommended Next Steps

${brief.recommendedNextSteps.map((step) => `- ${step}`).join('\n') || '- None.'}
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
