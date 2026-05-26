import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { printInfo, printJson } from '../output.js';
import { printPrivatePacketHint } from '../private-hints.js';
import { loadConfig } from '../../core/config-service.js';
import { createMark } from '../../core/packet-service.js';
import type { SourceLink } from '../../types/records.js';

type MarkOptions = {
  file?: string[];
  summary?: string;
  supersedes?: string;
  tags?: string;
  title?: string;
};

export function registerMarkCommand(program: Command): void {
  program
    .command('mark')
    .description('capture a self-addressed private packet')
    .requiredOption('--summary <summary>', 'mark summary')
    .option('--title <title>', 'mark title')
    .option('--supersedes <id>', 'record ID this mark supersedes')
    .option('--file <path>', 'attach a source file link', collect, [])
    .option('--tags <tags>', 'comma-separated tags')
    .action(async (options: MarkOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadConfig({
        ...(context.cwd ? { cwd: context.cwd } : {}),
        ...(context.store ? { store: context.store } : {}),
      });
      const sourceLinks: SourceLink[] = (options.file ?? []).map((file) => ({ kind: 'file', path: file }));
      const result = await createMark(loaded, {
        ...(context.actor ? { actor: context.actor } : {}),
        ...(context.agent ? { agent: context.agent } : {}),
        sourceLinks,
        ...(context.sourceTool ? { sourceTool: context.sourceTool } : {}),
        summary: required(options.summary, '--summary'),
        ...(options.supersedes ? { supersedes: options.supersedes } : {}),
        tags: parseTags(options.tags),
        ...(options.title ? { title: options.title } : {}),
      });

      if (context.output.json) {
        printJson(result);
        return;
      }

      printInfo(`Marked ${result.packet.id}`, context.output);
      printInfo(result.path, context.output);
      printPrivatePacketHint(result.packet, context.output);
    });
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function parseTags(value: string | undefined): string[] {
  return value ? value.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
}

function required(value: string | undefined, flag: string): string {
  if (!value) {
    throw new Error(`Missing required option ${flag}`);
  }

  return value;
}
