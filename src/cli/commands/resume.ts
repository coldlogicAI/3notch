import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { printJson } from '../output.js';
import { loadConfig } from '../../core/config-service.js';
import { resumeWorkingState } from '../../core/continuation-service.js';

type ResumeOptions = {
  includePrivate?: boolean;
};

export function registerResumeCommand(program: Command): void {
  program
    .command('resume')
    .description('print the latest continuation for this store without prompting')
    .option('--include-private', 'include private continuation packets')
    .action(async (options: ResumeOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadConfig({
        ...(context.cwd ? { cwd: context.cwd } : {}),
        ...(context.store ? { store: context.store } : {}),
      });
      const result = await resumeWorkingState(loaded, {
        includePrivate: Boolean(options.includePrivate),
      });

      if (context.output.json) {
        printJson(result);
        return;
      }

      if (result.checkpoint) {
        process.stdout.write(`${result.checkpoint.markdown}\n`);
      }
    });
}
