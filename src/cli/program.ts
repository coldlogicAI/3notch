import { Command } from 'commander';

import { VERSION } from '../core/version.js';
import { registerBriefCommand } from './commands/brief.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerOnboardCommand } from './commands/onboard.js';
import { registerPacketCommand } from './commands/packet.js';
import { registerSeedCommand } from './commands/seed.js';
import { registerStatusCommand } from './commands/status.js';

export function createProgram(): Command {
  const program = new Command()
    .name('notch')
    .description('Local-first private context packets across repos and AI tools.')
    .version(VERSION, '-v, --version', 'print the 3Notch version')
    .option('--cwd <path>', 'run 3Notch as if started from another project directory')
    .option('--store <path>', 'use a specific .notch store path')
    .option('--json', 'emit machine-readable JSON where supported')
    .option('-q, --quiet', 'reduce non-essential output')
    .option('--no-color', 'disable color output')
    .option('--actor <name>', 'display name for the writer')
    .option('--agent <name>', 'mark CLI writes as agent-authored and unreviewed')
    .option('--source-tool <name>', 'tool creating the record')
    .showHelpAfterError()
    .addHelpText(
      'after',
      `
Examples:
  $ notch --help
  $ notch --version
  $ notch onboard --yes

V1 implementation note:
  Command mcp serve is being implemented
  from docs/3notch-v1-implementation-plan.md. Deferred surfaces like pass and send are out of scope.
`,
    );

  registerOnboardCommand(program);
  registerBriefCommand(program);
  registerPacketCommand(program);
  registerSeedCommand(program);
  registerStatusCommand(program);
  registerDoctorCommand(program);

  return program;
}
