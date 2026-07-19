import { createHash } from 'node:crypto';
import { open, readFile, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

import { loadConfig, type LoadedConfig } from './config-service.js';
import { readGitSnapshot, type GitSnapshot } from './git-service.js';
import { toSlug } from './id-service.js';
import { createPacket, listPackets } from './packet-service.js';
import { atomicWriteFile, ensureDir } from './store-service.js';

export type ClaudeHookEvent =
  | 'SessionStart'
  | 'TaskCreated'
  | 'TaskCompleted'
  | 'PostCompact'
  | 'StopFailure'
  | 'Stop';

export type ClaudeHookInput = {
  session_id: string;
  cwd: string;
  hook_event_name: ClaudeHookEvent;
  source?: 'startup' | 'resume' | 'clear' | 'compact';
  task_id?: string;
  task_subject?: string;
  task_description?: string;
  trigger?: 'manual' | 'auto';
  compact_summary?: string;
  error?: string;
  last_assistant_message?: string;
  // Claude also supplies transcript_path. It is deliberately not represented or read.
};

type ContinuationTask = {
  id: string;
  subject: string;
  description?: string;
  status: 'pending' | 'completed';
  updatedAt: string;
};

type ContinuationSessionState = {
  schemaVersion: 1;
  sessionId: string;
  stream: string;
  startedAt: string;
  activityAt?: string;
  interruptedAt?: string;
  offeredCheckpointId?: string;
  lastCheckpointId?: string;
  lastFingerprint?: string;
  lastFlushedAt?: string;
  startGit: GitSnapshot;
  tasks: Record<string, ContinuationTask>;
};

export type ClaudeHookOutput = {
  systemMessage?: string;
  hookSpecificOutput?: {
    hookEventName: 'SessionStart';
    additionalContext: string;
  };
};

const supportedEvents = new Set<ClaudeHookEvent>([
  'SessionStart',
  'TaskCreated',
  'TaskCompleted',
  'PostCompact',
  'StopFailure',
  'Stop',
]);

export async function runClaudeCodeHook(rawInput: unknown): Promise<ClaudeHookOutput> {
  try {
    const input = validateHookInput(rawInput);
    const context = await loadConfig({ cwd: input.cwd });
    const continuation = context.config.continuation;

    if (!continuation || continuation.mode === 'off') {
      return {};
    }

    if (!eventEnabled(continuation.claudeCode.events, input)) {
      return {};
    }

    const git = excludeStoreChanges(context, await readGitSnapshot(context.projectRoot));

    const stream = resolveContinuationStream(continuation.streamOverride, git);

    return await withSessionLock(context, input.session_id, stream, async () => {
      const state = await readSessionState(context, input.session_id, stream, git);
      return await handleEvent(context, input, state, git, stream);
    });
  } catch (error) {
    return {
      systemMessage: `3Notch continuation hook skipped: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function excludeStoreChanges(context: LoadedConfig, git: GitSnapshot): GitSnapshot {
  const relativeStore = path.relative(context.projectRoot, context.storePath).split(path.sep).join('/');
  const prefix = relativeStore && relativeStore !== '.' ? `${relativeStore}/` : undefined;
  const changedFiles = prefix
    ? git.changedFiles.filter((file) => file !== relativeStore && !file.startsWith(prefix))
    : git.changedFiles;

  return {
    ...(git.branch ? { branch: git.branch } : {}),
    changedFiles,
    ...(git.commit ? { commit: git.commit } : {}),
    dirty: changedFiles.length > 0,
  };
}

export function resolveContinuationStream(override: string | undefined, git: GitSnapshot): string {
  if (override) {
    return toStreamSlug(override);
  }

  if (git.branch) {
    return toStreamSlug(git.branch);
  }

  if (git.commit) {
    return `detached-${git.commit.slice(0, 8)}`;
  }

  return 'default';
}

function validateHookInput(value: unknown): ClaudeHookInput {
  if (!value || typeof value !== 'object') {
    throw new Error('Claude hook input must be a JSON object.');
  }

  const input = value as Record<string, unknown>;
  const event = input.hook_event_name;
  const source = typeof input.source === 'string' && ['startup', 'resume', 'clear', 'compact'].includes(input.source)
    ? input.source as NonNullable<ClaudeHookInput['source']>
    : undefined;
  const trigger = input.trigger === 'manual' || input.trigger === 'auto'
    ? input.trigger
    : undefined;

  if (typeof input.session_id !== 'string' || input.session_id.length === 0) {
    throw new Error('Claude hook input is missing session_id.');
  }

  if (typeof input.cwd !== 'string' || input.cwd.length === 0) {
    throw new Error('Claude hook input is missing cwd.');
  }

  if (typeof event !== 'string' || !supportedEvents.has(event as ClaudeHookEvent)) {
    throw new Error(`Unsupported Claude hook event: ${String(event)}`);
  }

  return {
    session_id: input.session_id,
    cwd: input.cwd,
    hook_event_name: event as ClaudeHookEvent,
    ...(source ? { source } : {}),
    ...(typeof input.task_id === 'string' ? { task_id: input.task_id } : {}),
    ...(typeof input.task_subject === 'string' ? { task_subject: input.task_subject } : {}),
    ...(typeof input.task_description === 'string' ? { task_description: input.task_description } : {}),
    ...(trigger ? { trigger } : {}),
    ...(typeof input.compact_summary === 'string' ? { compact_summary: input.compact_summary } : {}),
    ...(typeof input.error === 'string' ? { error: input.error } : {}),
    ...(typeof input.last_assistant_message === 'string' ? { last_assistant_message: input.last_assistant_message } : {}),
  };
}

function eventEnabled(events: string[], input: ClaudeHookInput): boolean {
  if (input.hook_event_name === 'StopFailure') {
    return input.error === 'rate_limit' && events.includes('StopFailure:rate_limit');
  }

  return events.includes(input.hook_event_name);
}

async function handleEvent(
  context: LoadedConfig,
  input: ClaudeHookInput,
  state: ContinuationSessionState,
  git: GitSnapshot,
  stream: string,
): Promise<ClaudeHookOutput> {
  switch (input.hook_event_name) {
    case 'SessionStart':
      return await handleSessionStart(context, input, state, stream);
    case 'TaskCreated':
      updateTask(state, input, 'pending');
      await writeSessionState(context, state);
      return {};
    case 'TaskCompleted':
      updateTask(state, input, 'completed');
      await writeSessionState(context, state);
      return {};
    case 'PostCompact':
      if (!input.compact_summary?.trim()) {
        return {};
      }
      return await flushCheckpoint(context, state, git, stream, {
        event: 'post-compact',
        primarySummary: input.compact_summary.trim(),
        ...(input.trigger ? { trigger: input.trigger } : {}),
      });
    case 'StopFailure':
      state.interruptedAt = new Date().toISOString();
      if (!hasMaterialRecoveryState(state, git)) {
        await writeSessionState(context, state);
        return {};
      }
      return await flushCheckpoint(context, state, git, stream, {
        event: 'rate-limit',
        primarySummary: 'Claude Code stopped because the API rate limit was reached. This fallback contains only structured task events and repository state captured before the failure.',
      });
    case 'Stop': {
      const message = input.last_assistant_message?.trim();
      if (!message) {
        return {};
      }
      return await flushCheckpoint(context, state, git, stream, {
        event: 'stop',
        primarySummary: message,
      });
    }
  }
}

async function handleSessionStart(
  context: LoadedConfig,
  input: ClaudeHookInput,
  state: ContinuationSessionState,
  stream: string,
): Promise<ClaudeHookOutput> {
  const agentPolicy = renderAgentCheckpointPolicy(context, stream);

  if (input.source === 'compact') {
    await writeSessionState(context, state);
    return agentPolicy
      ? sessionStartContext(agentPolicy)
      : {};
  }

  const latest = await latestStreamCheckpoint(context, stream);

  if (!latest || state.offeredCheckpointId === latest.packet.id) {
    await writeSessionState(context, state);
    return agentPolicy
      ? sessionStartContext(agentPolicy)
      : {};
  }

  state.offeredCheckpointId = latest.packet.id;
  await writeSessionState(context, state);
  const privateRead = latest.packet.sensitivity === 'private'
    ? ' After confirmation, call get_packet with includePrivate true.'
    : '';
  const offer = `3Notch found continuation checkpoint ${latest.packet.id} (${latest.packet.title}) for stream ${stream}. Offer it to the user once. Do not call get_packet or load its contents unless the user confirms.${privateRead}`;

  return {
    systemMessage: `3Notch continuation available for ${stream}: ${latest.packet.title}.`,
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: [agentPolicy, offer].filter(Boolean).join('\n\n'),
    },
  };
}

function renderAgentCheckpointPolicy(context: LoadedConfig, stream: string): string | undefined {
  const continuation = context.config.continuation;

  if (!continuation || continuation.mode === 'off' || continuation.mode === 'script') {
    return undefined;
  }

  const behavior = continuation.mode === 'prompt'
    ? 'At each configured semantic trigger, ask the user whether to create a continuation checkpoint. Create it only after confirmation.'
    : 'At each configured semantic trigger, create a continuation checkpoint automatically without interrupting the workflow.';
  const triggers = continuation.semanticTriggers.map((trigger) => `- ${trigger}`).join('\n');

  const privateListInstruction = continuation.sensitivity === 'private'
    ? ' with includePrivate true'
    : '';

  return `3Notch semantic continuation policy (${continuation.mode} mode).
${behavior}

Configured triggers:
${triggers || '- None.'}

For an approved checkpoint, use list_packets${privateListInstruction} with tags continuation and stream-${stream} to find the latest predecessor, then call create_packet with:
- recipient next-agent
- sensitivity ${continuation.sensitivity}
- tags continuation, stream-${stream}, source-agent
- supersedes set to the latest same-stream checkpoint when present
- a concise but complete summary of objective, completed work, decisions, constraints, verification, blockers, relevant files, exact next action, and what not to redo

Do not change continuation mode, triggers, sensitivity, or stream unless the user explicitly asks.`;
}

function sessionStartContext(additionalContext: string): ClaudeHookOutput {
  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext,
    },
  };
}

function updateTask(
  state: ContinuationSessionState,
  input: ClaudeHookInput,
  status: ContinuationTask['status'],
): void {
  if (!input.task_id || !input.task_subject) {
    throw new Error(`${input.hook_event_name} input requires task_id and task_subject.`);
  }

  const now = new Date().toISOString();
  const existing = state.tasks[input.task_id];
  state.tasks[input.task_id] = {
    id: input.task_id,
    subject: input.task_subject,
    ...(input.task_description
      ? { description: input.task_description }
      : existing?.description
        ? { description: existing.description }
        : {}),
    status,
    updatedAt: now,
  };
  state.activityAt = now;
}

async function flushCheckpoint(
  context: LoadedConfig,
  state: ContinuationSessionState,
  git: GitSnapshot,
  stream: string,
  source: { event: 'post-compact' | 'rate-limit' | 'stop'; primarySummary: string; trigger?: string },
): Promise<ClaudeHookOutput> {
  return await withCheckpointWriteLock(context, async () => {
    const fingerprint = recoveryFingerprint(state, git, source);

    if (state.lastFingerprint === fingerprint) {
      return {};
    }

    const latest = await latestStreamCheckpoint(context, stream);
    const summary = renderRecoverySummary(source.primarySummary, state, git, source);
    const firstPending = Object.values(state.tasks).find((task) => task.status === 'pending');
    const idDiscriminator = createHash('sha256')
      .update(`${state.sessionId}\0${fingerprint}`)
      .digest('hex')
      .slice(0, 12);
    const result = await createPacket(context, {
      agent: 'Claude Code hook',
      idDiscriminator,
      importNotes: `Automatically created from documented Claude Code ${source.event} hook fields and Git metadata. No transcript was read.`,
      nextSteps: firstPending
        ? `Review this unreviewed fallback, confirm it matches the current project state, then continue with: ${firstPending.subject}`
        : 'Review this unreviewed fallback, confirm it matches the current project state, then choose the next action.',
      purpose: 'handoff',
      sensitivity: context.config.continuation?.sensitivity ?? 'project',
      sourceTool: 'claude-code',
      summary,
      ...(latest ? { supersedes: latest.packet.id } : {}),
      tags: ['continuation', `stream-${stream}`, `source-${source.event}`, 'fallback'],
      task: renderTaskProgress(state.tasks),
      title: continuationTitle(context.config.project.name, stream, source.event),
      toAgent: 'next-agent',
    });

    state.lastCheckpointId = result.packet.id;
    state.lastFingerprint = fingerprint;
    state.lastFlushedAt = new Date().toISOString();
    await writeSessionState(context, state);

    return {
      systemMessage: `3Notch wrote unreviewed continuation ${result.packet.id} for stream ${stream}.`,
    };
  });
}

function renderRecoverySummary(
  primarySummary: string,
  state: ContinuationSessionState,
  git: GitSnapshot,
  source: { event: string; trigger?: string },
): string {
  const tasks = Object.values(state.tasks);
  const completed = tasks.filter((task) => task.status === 'completed');
  const pending = tasks.filter((task) => task.status === 'pending');
  const changedFiles = git.changedFiles.length > 0
    ? git.changedFiles.map((file) => `- ${file}`).join('\n')
    : '- None detected.';

  return `${primarySummary}

### Structured Task Progress

- Completed: ${completed.length}
- Remaining: ${pending.length}

${renderTaskProgress(state.tasks)}

### Repository State

- Branch: ${git.branch ?? 'unknown'}
- Commit: ${git.commit ?? 'unknown'}
- Dirty: ${git.dirty ? 'yes' : 'no'}

Changed files:
${changedFiles}

### Capture Boundary

- Source event: ${source.event}${source.trigger ? ` (${source.trigger})` : ''}
- No transcript was read.
- No file contents or artifacts were copied automatically.`;
}

function renderTaskProgress(tasks: Record<string, ContinuationTask>): string {
  const entries = Object.values(tasks);

  if (entries.length === 0) {
    return '- No structured Claude tasks were captured.';
  }

  return entries
    .map((task) => `- [${task.status === 'completed' ? 'x' : ' '}] ${task.subject}${task.description ? ` — ${task.description}` : ''}`)
    .join('\n');
}

function continuationTitle(projectName: string, stream: string, event: string): string {
  return `Continuation: ${projectName}/${stream} (${event})`;
}

function recoveryFingerprint(
  state: ContinuationSessionState,
  git: GitSnapshot,
  source: { event: string; primarySummary: string; trigger?: string },
): string {
  return createHash('sha256')
    .update(JSON.stringify({ tasks: state.tasks, git, source }))
    .digest('hex');
}

function hasMaterialRecoveryState(state: ContinuationSessionState, git: GitSnapshot): boolean {
  return Object.keys(state.tasks).length > 0 || git.dirty || git.commit !== state.startGit.commit || git.branch !== state.startGit.branch;
}

async function latestStreamCheckpoint(context: LoadedConfig, stream: string) {
  const sensitivity = context.config.continuation?.sensitivity ?? 'project';
  const packets = await listPackets(context, {
    includePrivate: true,
    limit: 1,
    sensitivity,
    tags: ['continuation', `stream-${stream}`],
  });

  return packets[0];
}

async function readSessionState(
  context: LoadedConfig,
  sessionId: string,
  stream: string,
  git: GitSnapshot,
): Promise<ContinuationSessionState> {
  const filePath = sessionStatePath(context, sessionId, stream);
  const raw = await readFile(filePath, 'utf8').catch(() => undefined);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ContinuationSessionState;
      if (parsed.schemaVersion === 1 && parsed.sessionId === sessionId) {
        parsed.stream = stream;
        return parsed;
      }
    } catch {
      // Derived state is disposable. Replace malformed state with a clean accumulator.
    }
  }

  return {
    schemaVersion: 1,
    sessionId,
    stream,
    startedAt: new Date().toISOString(),
    startGit: git,
    tasks: {},
  };
}

async function writeSessionState(context: LoadedConfig, state: ContinuationSessionState): Promise<void> {
  await atomicWriteFile(sessionStatePath(context, state.sessionId, state.stream), `${JSON.stringify(state, null, 2)}\n`);
}

function sessionStatePath(context: LoadedConfig, sessionId: string, stream: string): string {
  const sessionSlug = toBoundedStateKey(sessionId);
  const streamSlug = toBoundedStateKey(stream);
  return path.join(context.paths.index, 'continuation', `${sessionSlug}--${streamSlug}.json`);
}

function toStreamSlug(value: string): string {
  const slug = toSlug(value);

  if (slug.length <= 57) {
    return slug;
  }

  const hash = createHash('sha256').update(value).digest('hex').slice(0, 12);
  return `${slug.slice(0, 44)}-${hash}`;
}

function toBoundedStateKey(value: string): string {
  const slug = toSlug(value);

  if (slug.length <= 64) {
    return slug;
  }

  const hash = createHash('sha256').update(value).digest('hex').slice(0, 12);
  return `${slug.slice(0, 51)}-${hash}`;
}

async function withSessionLock<T>(
  context: LoadedConfig,
  sessionId: string,
  stream: string,
  operation: () => Promise<T>,
): Promise<T> {
  const lockPath = `${sessionStatePath(context, sessionId, stream)}.lock`;
  return await withFileLock(lockPath, operation);
}

async function withCheckpointWriteLock<T>(
  context: LoadedConfig,
  operation: () => Promise<T>,
): Promise<T> {
  const lockPath = path.join(context.paths.index, 'continuation', 'checkpoint-write.lock');
  return await withFileLock(lockPath, operation);
}

async function withFileLock<T>(lockPath: string, operation: () => Promise<T>): Promise<T> {
  let handle: Awaited<ReturnType<typeof open>> | undefined;

  await ensureDir(path.dirname(lockPath));

  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      handle = await open(lockPath, 'wx');
      break;
    } catch (error) {
      if (!isAlreadyExists(error)) {
        throw error;
      }

      const lockStat = await stat(lockPath).catch(() => undefined);
      if (lockStat && Date.now() - lockStat.mtimeMs > 30_000) {
        await unlink(lockPath).catch(() => undefined);
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  if (!handle) {
    throw new Error('another continuation hook is still updating this session');
  }

  try {
    return await operation();
  } finally {
    await handle.close();
    await unlink(lockPath).catch(() => undefined);
  }
}

function isAlreadyExists(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST');
}
