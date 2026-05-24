import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { printInfo, printJson } from '../output.js';
import { createTargetedBrief, getProjectBrief, getTargetedBrief, listTargetedBriefs } from '../../core/brief-service.js';
import { loadConfig } from '../../core/config-service.js';

type CreateBriefOptions = {
  exclude?: string[];
  file?: string[];
  goal?: string;
  slug?: string;
  tag?: string[];
  title?: string;
  to?: string;
  topic?: string[];
};

type ListBriefOptions = {
  limit?: string;
  status?: string;
  tag?: string[];
  to?: string;
};

type ShowBriefOptions = {
  metadata?: boolean;
};

export function registerBriefCommand(program: Command): void {
  const brief = program
    .command('brief')
    .description('show the default project brief')
    .action(async (_options: unknown, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadConfig({
        ...(context.cwd ? { cwd: context.cwd } : {}),
        ...(context.store ? { store: context.store } : {}),
      });
      const result = await getProjectBrief(loaded);

      if (context.output.json) {
        printJson({ brief: result.brief, markdown: result.markdown, warnings: result.warnings });
        return;
      }

      printInfo(result.markdown, context.output);
    });

  brief
    .command('create')
    .description('create a targeted brief')
    .requiredOption('--title <title>', 'brief title')
    .requiredOption('--to <agent>', 'target agent')
    .requiredOption('--goal <goal>', 'goal for the target agent')
    .option('--topic <topic>', 'scope topic', collect, [])
    .option('--file <path>', 'scope file path', collect, [])
    .option('--exclude <text>', 'explicit exclusion', collect, [])
    .option('--tag <tag>', 'tag', collect, [])
    .option('--slug <slug>', 'explicit filename slug')
    .action(async (options: CreateBriefOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadConfig({
        ...(context.cwd ? { cwd: context.cwd } : {}),
        ...(context.store ? { store: context.store } : {}),
      });
      const result = await createTargetedBrief(loaded, {
        ...(context.actor ? { actor: context.actor } : {}),
        ...(context.agent ? { agent: context.agent } : {}),
        ...(context.sourceTool ? { sourceTool: context.sourceTool } : {}),
        designBasis: 'Created from notch brief create.',
        exclusions: options.exclude ?? [],
        goal: required(options.goal, '--goal'),
        priorReasoningSummary: 'No prior reasoning summary supplied.',
        scope: {
          files: options.file ?? [],
          topics: options.topic ?? [],
        },
        ...(options.slug ? { slug: options.slug } : {}),
        tags: options.tag ?? [],
        targetAgent: required(options.to, '--to'),
        title: required(options.title, '--title'),
      });

      if (context.output.json) {
        printJson({ brief: result.brief, path: result.path, warnings: result.warnings });
        return;
      }

      printInfo(`Created targeted brief ${result.brief.id}`, context.output);
      printInfo(result.path, context.output);
    });

  brief
    .command('list')
    .description('list targeted briefs')
    .option('--tag <tag>', 'filter by tag', collect, [])
    .option('--to <agent>', 'filter by target agent')
    .option('--status <status>', 'filter by status')
    .option('--limit <n>', 'maximum number of briefs')
    .action(async (options: ListBriefOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadConfig({
        ...(context.cwd ? { cwd: context.cwd } : {}),
        ...(context.store ? { store: context.store } : {}),
      });
      const briefs = await listTargetedBriefs(loaded, {
        ...(options.limit ? { limit: Number(options.limit) } : {}),
        ...(options.status ? { status: options.status } : {}),
        ...(options.tag && options.tag.length > 0 ? { tags: options.tag } : {}),
        ...(options.to ? { targetAgent: options.to } : {}),
      });

      if (context.output.json) {
        printJson({ briefs });
        return;
      }

      for (const item of briefs) {
        printInfo(`${item.id}\t${item.targetAgent}\t${item.title}`, context.output);
      }
    });

  brief
    .command('show')
    .description('show a targeted brief by ID or slug')
    .argument('<id>')
    .option('--metadata', 'include metadata in text output')
    .action(async (id: string, options: ShowBriefOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadConfig({
        ...(context.cwd ? { cwd: context.cwd } : {}),
        ...(context.store ? { store: context.store } : {}),
      });
      const result = await getTargetedBrief(loaded, id);

      if (context.output.json) {
        printJson({ brief: result.brief, markdown: result.markdown, path: result.path });
        return;
      }

      printInfo(options.metadata ? result.markdown : result.body, context.output);
    });
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function required(value: string | undefined, flag: string): string {
  if (!value) {
    throw new Error(`Missing required option ${flag}`);
  }

  return value;
}
