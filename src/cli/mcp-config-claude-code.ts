import { copyFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { notchMcpServerDefinition } from './mcp-instructions.js';
import { atomicWriteFile } from '../core/store-service.js';
import { NotchException } from '../types/errors.js';
import type { ClaudeCodeContinuationEvent, NotchConfig } from '../types/records.js';

type McpJsonConfig = {
  mcpServers?: Record<string, unknown>;
  [key: string]: unknown;
};

type ClaudeHook = {
  command?: unknown;
  type?: unknown;
  [key: string]: unknown;
};

type ClaudeHookRule = {
  hooks?: unknown;
  matcher?: unknown;
  [key: string]: unknown;
};

type ClaudeCodeSettings = {
  hooks?: unknown;
  [key: string]: unknown;
};

export const DEFAULT_CONTINUATION_EVENTS: ClaudeCodeContinuationEvent[] = [
  'SessionStart',
  'TaskCreated',
  'TaskCompleted',
  'PostCompact',
  'StopFailure:rate_limit',
];

export const DEFAULT_SEMANTIC_TRIGGERS = [
  'After a meaningful milestone',
  'Before switching agents or models',
  'Before ending substantial work',
];

export const CLAUDE_CODE_HOOK_COMMAND = 'notch hook claude-code';

export type McpConfigWriteResult = {
  backupPath?: string;
  configPath: string;
  serverName: '3notch';
  wrote: boolean;
};

export type ClaudeCodeHookConfigResult = {
  backupPath?: string;
  configPath: string;
  events: ClaudeCodeContinuationEvent[];
  wrote: boolean;
};

export type ClaudeCodeHookInspection = {
  configPath: string;
  error?: string;
  events: ClaudeCodeContinuationEvent[];
  hasOwnedHooks: boolean;
};

export async function configureClaudeCodeMcp(
  projectRoot: string,
  storePath: string,
  includePrivate = false,
): Promise<McpConfigWriteResult> {
  const configPath = path.join(projectRoot, '.mcp.json');
  const existing = await readJsonIfExists(configPath);
  const nextConfig: McpJsonConfig = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers ?? {}),
      '3notch': notchMcpServerDefinition(storePath, includePrivate),
    },
  };

  if (JSON.stringify(existing) === JSON.stringify(nextConfig)) {
    return { configPath, serverName: '3notch', wrote: false };
  }

  const backupPath = await backupIfExists(configPath);
  await atomicWriteFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`);

  return {
    ...(backupPath ? { backupPath } : {}),
    configPath,
    serverName: '3notch',
    wrote: true,
  };
}

export async function configureClaudeCodeContinuation(
  projectRoot: string,
  continuation: NotchConfig['continuation'],
): Promise<ClaudeCodeHookConfigResult> {
  const configPath = claudeCodeSettingsPath(projectRoot);
  const existsAlready = await exists(configPath);
  const existing = await readClaudeSettings(configPath);
  const desiredEvents = continuation && continuation.mode !== 'off'
    ? continuation.claudeCode.events
    : [];
  const next = mergeContinuationHooks(existing, desiredEvents);

  if (JSON.stringify(existing) === JSON.stringify(next) || (!existsAlready && desiredEvents.length === 0)) {
    return { configPath, events: desiredEvents, wrote: false };
  }

  const backupPath = await backupIfExists(
    configPath,
    path.join(projectRoot, '.notch', 'index', 'backups', 'claude-settings.local.json.bak'),
  );
  await atomicWriteFile(configPath, `${JSON.stringify(next, null, 2)}\n`);

  return {
    ...(backupPath ? { backupPath } : {}),
    configPath,
    events: desiredEvents,
    wrote: true,
  };
}

export async function inspectClaudeCodeContinuation(projectRoot: string): Promise<ClaudeCodeHookInspection> {
  const configPath = claudeCodeSettingsPath(projectRoot);

  try {
    const settings = await readClaudeSettings(configPath);
    return {
      configPath,
      events: ownedContinuationEvents(settings),
      hasOwnedHooks: hasOwnedContinuationHooks(settings),
    };
  } catch (error) {
    return {
      configPath,
      events: [],
      hasOwnedHooks: false,
      error: error instanceof Error ? error.message : 'Claude Code settings could not be read.',
    };
  }
}

function hasOwnedContinuationHooks(settings: ClaudeCodeSettings): boolean {
  const hooks = asHooksRecord(settings.hooks);
  return Object.entries(hooks).some(([event, value]) => containsOwnedHook(event, value));
}

export function continuationResyncCommand(continuation: NonNullable<NotchConfig['continuation']>): string {
  const stopFlag = continuation.mode !== 'off' && continuation.claudeCode.events.includes('Stop')
    ? ' --checkpoint-stop'
    : '';
  return `notch onboard --yes --mcp claude-code --checkpoints ${continuation.mode}${stopFlag}`;
}

function claudeCodeSettingsPath(projectRoot: string): string {
  return path.join(projectRoot, '.claude', 'settings.local.json');
}

function mergeContinuationHooks(
  existing: ClaudeCodeSettings,
  desiredEvents: ClaudeCodeContinuationEvent[],
): ClaudeCodeSettings {
  const next: ClaudeCodeSettings = { ...existing };
  const existingHooks = asHooksRecord(existing.hooks);
  const hooks: Record<string, unknown> = {};
  let removedOwnedHook = false;

  for (const [event, rules] of Object.entries(existingHooks)) {
    const cleaned = removeOwnedHooks(event, rules);
    const ownedBefore = containsOwnedHook(event, rules);
    removedOwnedHook ||= ownedBefore;

    if (!(ownedBefore && Array.isArray(cleaned) && cleaned.length === 0)) {
      hooks[event] = cleaned;
    }
  }

  for (const event of desiredEvents) {
    const { hookEvent, matcher } = hookTarget(event);
    const current = hooks[hookEvent];
    const rules = Array.isArray(current) ? [...current] : [];
    rules.push({
      ...(matcher ? { matcher } : {}),
      hooks: [{ type: 'command', command: CLAUDE_CODE_HOOK_COMMAND }],
    });
    hooks[hookEvent] = rules;
  }

  if (Object.keys(hooks).length > 0 || desiredEvents.length > 0 || (!removedOwnedHook && existing.hooks !== undefined)) {
    next.hooks = hooks;
  } else {
    delete next.hooks;
  }
  return next;
}

function containsOwnedHook(event: string, value: unknown): boolean {
  if (!Array.isArray(value)) {
    throw invalidClaudeSettings(`hooks.${event} must be an array.`);
  }

  return value.some((rule) => {
    if (!isObject(rule)) {
      return false;
    }

    const hooks = (rule as ClaudeHookRule).hooks;
    return Array.isArray(hooks) && hooks.some(isOwnedHook);
  });
}

function removeOwnedHooks(event: string, value: unknown): unknown {
  if (!Array.isArray(value)) {
    throw invalidClaudeSettings(`hooks.${event} must be an array.`);
  }

  return value.flatMap((rule): unknown[] => {
    if (!isObject(rule)) {
      return [rule];
    }

    const typedRule = rule as ClaudeHookRule;

    if (!Array.isArray(typedRule.hooks)) {
      return [rule];
    }

    const remaining = typedRule.hooks.filter((hook) => !isOwnedHook(hook));

    if (remaining.length === 0) {
      return [];
    }

    return [{ ...typedRule, hooks: remaining }];
  });
}

function ownedContinuationEvents(settings: ClaudeCodeSettings): ClaudeCodeContinuationEvent[] {
  const hooks = asHooksRecord(settings.hooks);
  const found: ClaudeCodeContinuationEvent[] = [];

  for (const [event, value] of Object.entries(hooks)) {
    if (!Array.isArray(value)) {
      throw invalidClaudeSettings(`hooks.${event} must be an array.`);
    }

    for (const rule of value) {
      if (!isObject(rule)) {
        continue;
      }

      const typedRule = rule as ClaudeHookRule;
      const ruleHooks = typedRule.hooks;

      if (!Array.isArray(ruleHooks) || !ruleHooks.some(isOwnedHook)) {
        continue;
      }

      const normalized = normalizeHookEvent(event, typedRule.matcher);

      if (normalized && !found.includes(normalized)) {
        found.push(normalized);
      }
    }
  }

  return found;
}

function normalizeHookEvent(event: string, matcher: unknown): ClaudeCodeContinuationEvent | undefined {
  if (event === 'StopFailure' && matcher === 'rate_limit') {
    return 'StopFailure:rate_limit';
  }

  if (event === 'SessionStart' && matcher === 'startup|resume|clear|compact') {
    return event;
  }

  if (
    (matcher === undefined || matcher === '') &&
    (event === 'TaskCreated' ||
    event === 'TaskCompleted' ||
    event === 'PostCompact' ||
    event === 'Stop')
  ) {
    return event;
  }

  return undefined;
}

function hookTarget(event: ClaudeCodeContinuationEvent): { hookEvent: string; matcher?: string } {
  if (event === 'StopFailure:rate_limit') {
    return { hookEvent: 'StopFailure', matcher: 'rate_limit' };
  }

  if (event === 'SessionStart') {
    return { hookEvent: event, matcher: 'startup|resume|clear|compact' };
  }

  return { hookEvent: event };
}

function isOwnedHook(value: unknown): boolean {
  return isObject(value) &&
    (value as ClaudeHook).type === 'command' &&
    (value as ClaudeHook).command === CLAUDE_CODE_HOOK_COMMAND;
}

function asHooksRecord(value: unknown): Record<string, unknown> {
  if (value === undefined) {
    return {};
  }

  if (!isObject(value) || Array.isArray(value)) {
    throw invalidClaudeSettings('hooks must be an object.');
  }

  return value;
}

async function readJsonIfExists(filePath: string): Promise<McpJsonConfig> {
  if (!(await exists(filePath))) {
    return {};
  }

  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as McpJsonConfig;

  return typeof parsed === 'object' && parsed !== null ? parsed : {};
}

async function readClaudeSettings(filePath: string): Promise<ClaudeCodeSettings> {
  if (!(await exists(filePath))) {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    throw invalidClaudeSettings(error instanceof Error ? error.message : 'Settings JSON could not be parsed.');
  }

  if (!isObject(parsed) || Array.isArray(parsed)) {
    throw invalidClaudeSettings('Settings root must be an object.');
  }

  asHooksRecord(parsed.hooks);
  return parsed;
}

function invalidClaudeSettings(message: string): NotchException {
  return new NotchException({
    code: 'NOTCH_CLAUDE_SETTINGS_INVALID',
    message: `Claude Code settings are invalid: ${message}`,
    recovery: 'Fix .claude/settings.local.json, then rerun notch onboard.',
    severity: 'error',
    exitCode: 3,
  });
}

async function backupIfExists(filePath: string, requestedBackupPath?: string): Promise<string | undefined> {
  if (!(await exists(filePath))) {
    return undefined;
  }

  const backupPath = requestedBackupPath ?? `${filePath}.bak`;

  if (requestedBackupPath) {
    await atomicWriteFile(backupPath, await readFile(filePath, 'utf8'));
  } else {
    await copyFile(filePath, backupPath);
  }
  return backupPath;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
