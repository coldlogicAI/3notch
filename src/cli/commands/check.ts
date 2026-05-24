import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { printInfo, printJson } from '../output.js';
import { checkStore } from '../../core/check-service.js';
import { loadConfig } from '../../core/config-service.js';

export function registerCheckCommand(program: Command): void {
  program
    .command('check')
    .description('run deterministic corpus integrity checks')
    .action(async (_options: Record<string, never>, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadConfig({
        ...(context.cwd ? { cwd: context.cwd } : {}),
        ...(context.store ? { store: context.store } : {}),
      });
      const result = await checkStore(loaded);

      if (context.output.json) {
        printJson(result);
      } else if (result.findings.length === 0) {
        printInfo('3Notch check: no findings.', context.output);
      } else {
        for (const finding of result.findings) {
          printInfo(`${finding.severity}\t${finding.rule}\t${finding.packetId}\t${finding.message}`, context.output);
        }
      }

      if (result.summary.errors > 0) {
        process.exitCode = 1;
      }
    });
}
