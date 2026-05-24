import { execFileSync } from 'node:child_process';
import os from 'node:os';

import type { Actor, ActorNameResolution, ActorTypeResolution, SourceTool } from '../types/records.js';

export type ResolveActorOptions = {
  actor?: string;
  agent?: string;
  cwd?: string;
  mcp?: boolean;
  sourceTool?: SourceTool['name'];
};

export type ResolvedActor = {
  actor: Actor;
  actorNameResolution: ActorNameResolution;
  actorTypeResolution: ActorTypeResolution;
  sourceTool: SourceTool;
};

export function resolveActor(options: ResolveActorOptions = {}): ResolvedActor {
  const actorName = options.actor ?? options.agent ?? gitUserName(options.cwd) ?? envUserName() ?? 'unknown';
  const actorNameResolution: ActorNameResolution = options.actor || options.agent
    ? options.mcp
      ? 'mcp-client'
      : 'cli-flag'
    : gitUserName(options.cwd)
      ? 'git-config'
      : envUserName()
        ? 'environment'
        : 'unknown';
  const actorType = options.mcp || options.agent ? 'agent' : 'human';
  const actorTypeResolution: ActorTypeResolution = options.mcp
    ? 'mcp-default'
    : options.agent
      ? 'cli-agent-flag'
      : 'cli-default';
  const sourceToolName: SourceTool['name'] = options.sourceTool ?? (options.mcp ? 'notch-mcp' : 'notch-cli');

  return {
    actor: {
      actorType,
      name: actorName,
      ...(options.agent ? { actorSlug: options.agent.toLowerCase().replace(/[^a-z0-9]+/g, '-') } : {}),
    },
    actorNameResolution,
    actorTypeResolution,
    sourceTool: { name: sourceToolName },
  };
}

function gitUserName(cwd?: string): string | undefined {
  try {
    const value = execFileSync('git', ['config', 'user.name'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    return value || undefined;
  } catch {
    return undefined;
  }
}

function envUserName(): string | undefined {
  return process.env.USER || process.env.USERNAME || os.userInfo().username || undefined;
}
