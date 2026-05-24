import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { printInfo, printJson } from '../output.js';
import { loadConfig } from '../../core/config-service.js';
import { getStatus } from '../../core/status-service.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('summarize the current 3Notch store')
    .action(async (_options: unknown, command: Command) => {
      const context = getCliContext(command);
      const loaded = await loadConfig({
        ...(context.cwd ? { cwd: context.cwd } : {}),
        ...(context.store ? { store: context.store } : {}),
      });
      const status = await getStatus(loaded);

      if (context.output.json) {
        printJson(status);
        return;
      }

      printInfo(`${status.projectName} (${status.storePath})`, context.output);
      printInfo(
        `briefs=${status.counts.targetedBriefs} inbox=${status.counts.inboxPackets} outbox=${status.counts.outboxPackets} privateSeeds=${status.counts.privateSeedPackets} issues=${status.counts.validationIssues}`,
        context.output,
      );
    });
}
