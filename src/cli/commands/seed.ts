import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { printInfo, printJson } from '../output.js';
import { loadConfig } from '../../core/config-service.js';
import { seedFrom } from '../../core/seed-service.js';

type SeedFromOptions = {
  include?: string[];
  review?: boolean;
};

export function registerSeedCommand(program: Command): void {
  const seed = program.command('seed').description('import reviewed private context seeds');

  seed
    .command('from')
    .description('seed this repo from a prior repo or store')
    .argument('<repo-or-store-path>')
    .option('--include <category>', 'context category to include', collect, [])
    .option('--review', 'confirm private context has been reviewed')
    .action(async (sourcePath: string, options: SeedFromOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadConfig({
        ...(context.cwd ? { cwd: context.cwd } : {}),
        ...(context.store ? { store: context.store } : {}),
      });
      const result = await seedFrom(loaded, {
        include: options.include ?? [],
        review: Boolean(options.review),
        sourcePath,
      });

      if (context.output.json) {
        printJson(result);
        return;
      }

      printInfo(`Imported private seed packet ${result.packet.id}`, context.output);
      printInfo(result.inboxPath, context.output);
    });
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}
