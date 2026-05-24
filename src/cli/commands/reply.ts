import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { printInfo, printJson } from '../output.js';
import { loadConfig } from '../../core/config-service.js';
import { createReply } from '../../core/packet-service.js';
import type { ReplyType, SourceLink } from '../../types/records.js';

type ReplyOptions = {
  file?: string[];
  private?: boolean;
  summary?: string;
  tags?: string;
  title?: string;
  toAgent?: string;
  toPerson?: string;
  toRepo?: string;
  type?: ReplyType;
};

export function registerReplyCommand(program: Command): void {
  program
    .command('reply')
    .description('author a typed packet reply to an existing record')
    .argument('<parent-id>')
    .requiredOption('--type <type>', 'reply type: question, clarification, counter-decision, objection, or confirmation')
    .requiredOption('--summary <summary>', 'reply summary')
    .option('--title <title>', 'reply title')
    .option('--to-agent <agent>', 'target agent')
    .option('--to-person <person>', 'target person')
    .option('--to-repo <repo>', 'target repo')
    .option('--private', 'force private sensitivity')
    .option('--file <path>', 'attach a source file link', collect, [])
    .option('--tags <tags>', 'comma-separated tags')
    .action(async (parentId: string, options: ReplyOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadConfig({
        ...(context.cwd ? { cwd: context.cwd } : {}),
        ...(context.store ? { store: context.store } : {}),
      });
      const sourceLinks: SourceLink[] = (options.file ?? []).map((file) => ({ kind: 'file', path: file }));
      const result = await createReply(loaded, {
        ...(context.actor ? { actor: context.actor } : {}),
        ...(context.agent ? { agent: context.agent } : {}),
        parentId,
        ...(options.private ? { private: true } : {}),
        replyType: requiredReplyType(options.type),
        sourceLinks,
        ...(context.sourceTool ? { sourceTool: context.sourceTool } : {}),
        summary: required(options.summary, '--summary'),
        tags: parseTags(options.tags),
        ...(options.title ? { title: options.title } : {}),
        ...(options.toAgent ? { toAgent: options.toAgent } : {}),
        ...(options.toPerson ? { toPerson: options.toPerson } : {}),
        ...(options.toRepo ? { toRepo: options.toRepo } : {}),
      });

      if (context.output.json) {
        printJson(result);
        return;
      }

      printInfo(`Replied with ${result.packet.id}`, context.output);
      printInfo(result.path, context.output);
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

function requiredReplyType(value: ReplyType | undefined): ReplyType {
  if (
    value === 'question'
    || value === 'clarification'
    || value === 'counter-decision'
    || value === 'objection'
    || value === 'confirmation'
  ) {
    return value;
  }

  throw new Error('Missing or invalid --type.');
}
