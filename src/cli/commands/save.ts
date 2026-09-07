import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { printInfo, printJson } from '../output.js';
import { printPrivatePacketHint } from '../private-hints.js';
import { loadConfig } from '../../core/config-service.js';
import { saveWorkingState } from '../../core/continuation-service.js';
import { NotchException } from '../../types/errors.js';

type SaveOptions = {
  nextSteps?: string;
  private?: boolean;
  summary?: string;
};

export function registerSaveCommand(program: Command): void {
  program
    .command('save')
    .description('write a continuation packet for this store from git snapshot and optional summary')
    .option('--summary <text>', 'working-state summary; pass - to read from stdin')
    .option('--next-steps <text>', 'what the next agent should do; pass - to read from stdin')
    .option('--private', 'write a private continuation packet')
    .action(async (options: SaveOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadConfig({
        ...(context.cwd ? { cwd: context.cwd } : {}),
        ...(context.store ? { store: context.store } : {}),
      });
      const fields = await resolveSaveFields(options);
      const result = await saveWorkingState(loaded, {
        ...(context.actor ? { actor: context.actor } : {}),
        ...(context.agent ? { agent: context.agent } : {}),
        ...(fields.nextSteps ? { nextSteps: fields.nextSteps } : {}),
        ...(options.private ? { private: true } : {}),
        ...(context.sourceTool ? { sourceTool: context.sourceTool } : {}),
        ...(fields.summary ? { summary: fields.summary } : {}),
      });

      if (context.output.json) {
        printJson(result);
        return;
      }

      printInfo(`Saved continuation ${result.packet.id}`, context.output);
      printInfo(result.outboxPath, context.output);
      printPrivatePacketHint(result.packet, context.output);
    });
}

async function resolveSaveFields(options: SaveOptions): Promise<{ nextSteps?: string; summary?: string }> {
  if (options.summary === '-' && options.nextSteps === '-') {
    throw new NotchException({
      code: 'NOTCH_SAVE_STDIN_CONFLICT',
      message: 'Only one of --summary or --next-steps can read stdin.',
      recovery: 'Pass text for one flag and - for the other, or pipe a summary with no - flags.',
      severity: 'error',
      exitCode: 1,
    });
  }

  const needsStdin = options.summary === '-' || options.nextSteps === '-' || !options.summary;
  const stdin = needsStdin && (options.summary === '-' || options.nextSteps === '-' || !process.stdin.isTTY)
    ? (await readStdin()).trim()
    : '';
  const summary = options.summary === '-'
    ? stdin || undefined
    : options.summary ?? (options.nextSteps === '-' ? undefined : stdin || undefined);
  const nextSteps = options.nextSteps === '-'
    ? stdin || undefined
    : options.nextSteps;

  return {
    ...(nextSteps ? { nextSteps } : {}),
    ...(summary ? { summary } : {}),
  };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString('utf8');
}
