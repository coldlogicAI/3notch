import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';

import { appendAuditEntry } from './audit-service.js';
import { loadConfig, type LoadedConfig } from './config-service.js';
import { createPacket, type CreatePacketInput } from './packet-service.js';
import { importPacketFile } from './transfer-service.js';
import { assertSafeRelativePath } from './path-safety.js';
import { createRecordMeta } from './record-factory.js';
import { parseAndValidateRecord } from './record-parser.js';
import { assertNoSecretsWithAudit } from './secret-scan-service.js';
import { renderMarkdownRecord, writeRecordWithCollisionHandling } from './store-service.js';
import { rebuildIndex } from './index-service.js';
import { toSlug } from './id-service.js';
import { NotchException } from '../types/errors.js';
import type { NotchPacket, SourceLink, SourceTool } from '../types/records.js';

export type SeedReviewer = (draftMarkdown: string, draftPath: string) => Promise<string | void>;

export type SeedFromInput = {
  actor?: string;
  agent?: string;
  files?: string[];
  include?: string[];
  review?: boolean;
  reviewer?: SeedReviewer;
  sourcePath: string;
  sourceTool?: SourceTool['name'];
};

type SeedCategory = 'lessons' | 'preferences' | 'workflow';

type SeedCarryContent = {
  fileLinks: SourceLink[];
  lessons: string[];
  preferences: string[];
  requested: Set<SeedCategory>;
  workflow: string[];
};

export async function createSeedPacket(
  context: LoadedConfig,
  input: Omit<CreatePacketInput, 'purpose' | 'sensitivity'>,
) {
  return await createPacket(context, {
    ...input,
    purpose: 'seed',
    sensitivity: 'private',
  });
}

export async function importSeedPacket(
  context: LoadedConfig,
  packetPath: string,
  options: {
    actor?: string;
    agent?: string;
    asReviewed?: boolean;
    mcp?: boolean;
    sourceTool?: SourceTool['name'];
  } = {},
) {
  return await importPacketFile(context, packetPath, { ...options, forcePrivate: true, seedOnly: true });
}

export async function seedFrom(context: LoadedConfig, input: SeedFromInput) {
  if (!input.review) {
    throw seedReviewRequiredError();
  }

  const source = await loadConfig({ cwd: input.sourcePath });
  const sourceBrief = await readFile(source.paths.brief, 'utf8').catch(() => '');
  const carry = buildSeedCarryContent(sourceBrief, {
    files: input.files ?? [],
    include: input.include ?? [],
    sourceRoot: source.config.project.root,
  });

  if (!hasSeedCarryContent(carry)) {
    throw new NotchException({
      code: 'NOTCH_SEED_NO_CONTENT',
      message: 'No reviewed seed content was found for the requested categories.',
      recovery: 'Add content to the source project brief, request different --include categories, or pass --file links.',
      severity: 'error',
      exitCode: 1,
    });
  }

  const title = `Private seed from ${source.config.project.name}`;
  const created = createRecordMeta({
    ...(input.actor ? { actor: input.actor } : {}),
    ...(input.agent ? { agent: input.agent } : {}),
    cwd: context.projectRoot,
    recordType: 'packet',
    ...(input.sourceTool ? { sourceTool: input.sourceTool } : {}),
    title,
  });
  const sourceLinks: SourceLink[] = [
    { kind: 'repo', repoRoot: source.config.project.root, repoName: source.config.project.name },
    ...carry.fileLinks,
  ];
  const summary = `Reviewed private seed from ${source.config.project.name}.`;
  const packet: NotchPacket = {
    ...created.meta,
    recordType: 'packet',
    title,
    purpose: 'seed',
    sensitivity: 'private',
    transferStatus: 'outbox',
    origin: {
      projectName: source.config.project.name,
      repoRoot: source.config.project.root,
      storePath: source.storePath,
    },
    recipient: {
      targetRepo: context.config.project.root,
    },
    summary,
    privateContextSummary: summarizeCarryContent(carry),
    includedRecords: [],
    includedSourceLinks: sourceLinks,
    importNotes: 'Imported through notch seed from after explicit review.',
  };
  const draftMarkdown = renderMarkdownRecord(packet, renderSeedPacketBody(packet, carry));
  const reviewedMarkdown = await reviewSeedDraft(draftMarkdown, input.reviewer);
  const parsed = parseAndValidateRecord<NotchPacket>(reviewedMarkdown);

  if (!parsed.ok) {
    throw new NotchException({
      ...parsed.errors[0],
      code: parsed.errors[0]?.code ?? 'NOTCH_RECORD_INVALID',
      message: parsed.errors[0]?.message ?? 'Reviewed seed packet is invalid.',
      severity: 'error',
      exitCode: 3,
    });
  }

  if (parsed.data.purpose !== 'seed' || parsed.data.sensitivity !== 'private') {
    throw new NotchException({
      code: 'NOTCH_RECORD_INVALID',
      message: 'Reviewed seed packets must keep purpose: seed and sensitivity: private.',
      recovery: 'Restore the seed packet metadata before saving the review file.',
      severity: 'error',
      exitCode: 3,
    });
  }

  await assertNoSecretsWithAudit(reviewedMarkdown, context.config, {
    actor: created.meta.createdBy,
    actorNameResolution: created.actorNameResolution,
    actorTypeResolution: created.actorTypeResolution,
    logsDir: context.paths.logs,
    recordId: parsed.data.id,
    recordType: 'packet',
    sourceTool: created.meta.sourceTool,
  });

  const written = await writeRecordWithCollisionHandling(context.storePath, {
    content: reviewedMarkdown,
    directory: context.paths.privateOutbox,
    slug: `${created.filenameBase}-to-${toSlug(source.config.project.name)}`,
  });

  await appendAuditEntry(context.paths.logs, {
    schemaVersion: '1.0.0',
    at: new Date().toISOString(),
    operation: 'create',
    result: 'success',
    actor: created.meta.createdBy,
    actorNameResolution: created.actorNameResolution,
    actorTypeResolution: created.actorTypeResolution,
    sourceTool: created.meta.sourceTool,
    recordType: 'packet',
    recordId: parsed.data.id,
    recordPath: written.relativePath,
  });
  await rebuildIndex(context.storePath);

  return await importSeedPacket(context, written.path, {
    ...(input.actor ? { actor: input.actor } : {}),
    ...(input.agent ? { agent: input.agent } : {}),
    asReviewed: true,
    ...(input.sourceTool ? { sourceTool: input.sourceTool } : {}),
  });
}

function buildSeedCarryContent(
  sourceBrief: string,
  input: { files: string[]; include: string[]; sourceRoot: string },
): SeedCarryContent {
  const requested = normalizeSeedCategories(input.include);
  const focus = markdownListItems(extractMarkdownSection(sourceBrief, 'Current Focus'));
  const constraints = markdownListItems(extractMarkdownSection(sourceBrief, 'Active Constraints'));
  const threads = markdownListItems(extractMarkdownSection(sourceBrief, 'Open Threads'));
  const fileLinks = input.files.map((file) => {
    const safe = assertSafeRelativePath(file, input.sourceRoot);
    return { kind: 'file' as const, path: safe.relativePath };
  });

  return {
    fileLinks,
    lessons: requested.has('lessons') ? threads : [],
    preferences: requested.has('preferences') ? focus : [],
    requested,
    workflow: requested.has('workflow') ? constraints : [],
  };
}

function normalizeSeedCategories(include: string[]): Set<SeedCategory> {
  if (include.length === 0) {
    return new Set<SeedCategory>(['lessons', 'preferences', 'workflow']);
  }

  const categories = new Set<SeedCategory>();

  for (const raw of include) {
    const value = raw.toLowerCase();

    if (['focus', 'preference', 'preferences', 'user-preferences'].includes(value)) {
      categories.add('preferences');
    } else if (['constraint', 'constraints', 'workflow', 'workflows', 'workflow-conventions'].includes(value)) {
      categories.add('workflow');
    } else if (['lesson', 'lessons', 'open-thread', 'open-threads', 'threads'].includes(value)) {
      categories.add('lessons');
    }
  }

  return categories;
}

function hasSeedCarryContent(carry: SeedCarryContent): boolean {
  return carry.preferences.length > 0 || carry.workflow.length > 0 || carry.lessons.length > 0 || carry.fileLinks.length > 0;
}

function summarizeCarryContent(carry: SeedCarryContent): string {
  const parts = [
    carry.preferences.length > 0 ? 'preferences' : '',
    carry.workflow.length > 0 ? 'workflow conventions' : '',
    carry.lessons.length > 0 ? 'lessons' : '',
    carry.fileLinks.length > 0 ? 'selected source links' : '',
  ].filter(Boolean);

  return parts.length > 0 ? `Reviewed ${parts.join(', ')}.` : 'Reviewed private seed context.';
}

function renderSeedPacketBody(packet: NotchPacket, carry: SeedCarryContent): string {
  return `## Summary

${packet.summary}

## Recipient

${packet.recipient.targetRepo ?? 'Private seed packet.'}

## Origin

${packet.origin.projectName} (${packet.origin.storePath})

## Included Context

${[
  carry.preferences.length > 0 ? '- Current focus from source project brief.' : '',
  carry.workflow.length > 0 ? '- Active constraints from source project brief.' : '',
  carry.lessons.length > 0 ? '- Open threads from source project brief.' : '',
].filter(Boolean).join('\n') || '- Selected file links only.'}

## Source Links

${packet.includedSourceLinks.map((link) => `- ${link.path ?? link.repoName ?? link.repoRoot ?? link.kind}`).join('\n') || '- None.'}

## Import Notes

${packet.importNotes ?? 'Review before use.'}

## User Preferences

${formatSeedList(carry.preferences, carry.requested.has('preferences'))}

## Workflow Conventions

${formatSeedList(carry.workflow, carry.requested.has('workflow'))}

## Lessons From Prior Work

${formatSeedList(carry.lessons, carry.requested.has('lessons'))}

## What Not To Carry Forward

- Hidden chat history or unreviewed private data.
- Raw file contents from selected --file links.
`;
}

function formatSeedList(items: string[], requested: boolean): string {
  if (items.length > 0) {
    return items.map((item) => `- ${item}`).join('\n');
  }

  return requested ? '- No matching reviewed source content found.' : '- Not requested.';
}

function extractMarkdownSection(markdown: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=^##\\s+|(?![\\s\\S]))`, 'm').exec(markdown);
  return match?.[1]?.trim() ?? '';
}

function markdownListItems(section: string): string[] {
  return section
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*]\s+/, '').trim())
    .filter((line) => line.length > 0 && line !== 'None.' && !line.startsWith('Replace this with'));
}

async function reviewSeedDraft(draftMarkdown: string, reviewer?: SeedReviewer): Promise<string> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'notch-seed-review-'));
  const draftPath = path.join(tempDir, 'seed-packet.md');
  let allowUnchanged = false;

  try {
    await writeFile(draftPath, draftMarkdown, 'utf8');

    if (reviewer) {
      const reviewed = await reviewer(draftMarkdown, draftPath);

      if (typeof reviewed === 'string') {
        await writeFile(draftPath, reviewed, 'utf8');
      }
    } else {
      allowUnchanged = await runReviewEditorOrConfirm(draftPath, draftMarkdown);
    }

    const reviewedMarkdown = await readFile(draftPath, 'utf8');

    if (reviewedMarkdown.trim().length === 0 || (!allowUnchanged && reviewedMarkdown === draftMarkdown)) {
      throw seedReviewRequiredError();
    }

    return reviewedMarkdown;
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function runReviewEditorOrConfirm(draftPath: string, draftMarkdown: string): Promise<boolean> {
  const editor = process.env.EDITOR || process.env.VISUAL;

  if (editor) {
    await runEditor(editor, draftPath);
    return false;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw seedReviewRequiredError();
  }

  process.stdout.write(`${draftMarkdown}\n`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Import this private seed packet? [y/N] ');
  rl.close();

  if (!/^y(es)?$/i.test(answer.trim())) {
    throw seedReviewRequiredError();
  }

  return true;
}

async function runEditor(editor: string, draftPath: string): Promise<void> {
  const [command, ...args] = editor.split(/\s+/).filter(Boolean);

  if (!command) {
    throw seedReviewRequiredError();
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [...args, draftPath], { stdio: 'inherit' });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(seedReviewRequiredError());
    });
  });
}

function seedReviewRequiredError(): NotchException {
  return new NotchException({
    code: 'NOTCH_SEED_REVIEW_REQUIRED',
    message: 'Private context seeding requires explicit review in V1.',
    recovery: 'Set EDITOR and re-run with --review, then save the reviewed seed packet.',
    severity: 'error',
    exitCode: 1,
  });
}
