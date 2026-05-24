import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { printInfo, printJson } from '../output.js';
import { loadConfig } from '../../core/config-service.js';
import { runDoctor } from '../../core/doctor-service.js';

type DoctorOptions = {
  fix?: boolean;
  strict?: boolean;
  yes?: boolean;
};

export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('validate and repair safe derived .notch state')
    .option('--fix', 'rebuild derived index and repair safe derived state')
    .option('--yes', 'apply safe fixes without prompting')
    .option('--strict', 'treat warnings as failures')
    .action(async (options: DoctorOptions, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadConfig({
        ...(context.cwd ? { cwd: context.cwd } : {}),
        ...(context.store ? { store: context.store } : {}),
      });
      const result = await runDoctor(loaded, {
        fix: Boolean(options.fix),
        strict: Boolean(options.strict),
      });

      if (context.output.json) {
        printJson(result);
      } else {
        for (const check of result.checks) {
          printInfo(`${check.severity}\t${check.code}\t${check.message}`, context.output);
        }
      }

      if (!result.healthy) {
        process.exitCode = result.errors.some((error) => error.exitCode === 6) ? 6 : 1;
      }
    });
}
