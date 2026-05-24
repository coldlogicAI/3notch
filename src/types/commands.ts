import type { Actor, SourceTool } from './records.js';

export type OutputMode = {
  color: boolean;
  json: boolean;
  quiet: boolean;
};

export type CommandRuntimeOptions = {
  actor?: string;
  agent?: string;
  cwd?: string;
  sourceTool?: SourceTool['name'];
  store?: string;
} & Partial<OutputMode>;

export type ResolvedCommandContext = {
  actor: Actor;
  actorNameResolution: 'cli-flag' | 'git-config' | 'environment' | 'unknown' | 'mcp-client';
  actorTypeResolution: 'cli-default' | 'cli-agent-flag' | 'mcp-default';
  cwd: string;
  output: OutputMode;
  sourceTool: SourceTool;
  storePath?: string;
};
