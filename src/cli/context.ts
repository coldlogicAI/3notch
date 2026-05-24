import type { Command } from 'commander';

import type { CommandRuntimeOptions, OutputMode } from '../types/commands.js';
import type { SourceTool } from '../types/records.js';

export type CliContext = {
  actor?: string;
  agent?: string;
  cwd?: string;
  output: OutputMode;
  sourceTool?: SourceTool['name'];
  store?: string;
};

type RawGlobalOptions = {
  actor?: string;
  agent?: string;
  color?: boolean;
  cwd?: string;
  json?: boolean;
  quiet?: boolean;
  sourceTool?: SourceTool['name'];
  store?: string;
};

export function getCliContext(command: Command): CliContext {
  const options = command.optsWithGlobals<RawGlobalOptions>();

  return {
    ...(options.actor ? { actor: options.actor } : {}),
    ...(options.agent ? { agent: options.agent } : {}),
    ...(options.cwd ? { cwd: options.cwd } : {}),
    output: {
      color: options.color ?? true,
      json: Boolean(options.json),
      quiet: Boolean(options.quiet),
    },
    ...(options.sourceTool ? { sourceTool: options.sourceTool } : {}),
    ...(options.store ? { store: options.store } : {}),
  };
}

export function toRuntimeOptions(context: CliContext): CommandRuntimeOptions {
  return {
    ...(context.actor ? { actor: context.actor } : {}),
    ...(context.agent ? { agent: context.agent } : {}),
    ...(context.cwd ? { cwd: context.cwd } : {}),
    ...(context.sourceTool ? { sourceTool: context.sourceTool } : {}),
    ...(context.store ? { store: context.store } : {}),
    color: context.output.color,
    json: context.output.json,
    quiet: context.output.quiet,
  };
}
