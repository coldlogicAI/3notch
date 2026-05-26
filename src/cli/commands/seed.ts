import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { printInfo, printJson } from '../output.js';
import { printPrivatePacketHint } from '../private-hints.js';
import { loadConfig } from '../../core/config-service.js';
import { seedFrom } from '../../core/seed-service.js';

type SeedFromOptions = {
  file?: string[];
  include?: string[];
  review?: boolean;
};

export function registerSeedCommand(program: Command): void {
  const seed = program.command('seed').description('import reviewed private context seeds');

  seed
    .command('from')
    .description('seed this repo from a prior repo or store')
    .argument('<repo-or-store-path>')
    .option('--file <path>', 'source file reference to carry as a link', collect, [])
    .option('--include <category>', 'context category to include', collect, [])
    .option('--review', 'open the generated private seed packet for review before import')
    .action(async (sourcePath: string, options: SeedFromOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadConfig({
        ...(context.cwd ? { cwd: context.cwd } : {}),
        ...(context.store ? { store: context.store } : {}),
      });
      const result = await seedFrom(loaded, {
        ...(context.actor ? { actor: context.actor } : {}),
        ...(context.agent ? { agent: context.agent } : {}),
        files: options.file ?? [],
        include: options.include ?? [],
        review: Boolean(options.review),
        sourcePath,
        ...(context.sourceTool ? { sourceTool: context.sourceTool } : {}),
      });

      if (context.output.json) {
        printJson(result);
        return;
      }

      printInfo(`Imported private seed packet ${result.packet.id}`, context.output);
      printInfo(result.inboxPath, context.output);
      printPrivatePacketHint(result.packet, context.output);
    });
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}
