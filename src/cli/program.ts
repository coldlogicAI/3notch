import { Command } from 'commander';

import { VERSION } from '../core/version.js';

export function createProgram(): Command {
  return new Command()
    .name('notch')
    .description('Local-first private context packets across repos and AI agents.')
    .version(VERSION, '-v, --version', 'print the 3Notch version')
    .option('--cwd <path>', 'run 3Notch as if started from another project directory')
    .option('--store <path>', 'use a specific .notch store path')
    .option('--json', 'emit machine-readable JSON where supported')
    .option('-q, --quiet', 'reduce non-essential output')
    .showHelpAfterError()
    .addHelpText(
      'after',
      `
Examples:
  $ notch --help
  $ notch --version

V1 implementation note:
  Commands like onboard, seed, packet, send, brief, pass, status, doctor, and mcp serve are planned
  but not implemented in this bootstrap slice.
`,
    );
}
