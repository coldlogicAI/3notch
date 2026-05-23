import { Command } from 'commander';

import { VERSION } from '../core/version.js';

export function createProgram(): Command {
  return new Command()
    .name('baton')
    .description('Local-first context passing for AI agents.')
    .version(VERSION, '-v, --version', 'print the Baton version')
    .option('--cwd <path>', 'run Baton as if started from another project directory')
    .option('--store <path>', 'use a specific .baton store path')
    .option('--json', 'emit machine-readable JSON where supported')
    .option('-q, --quiet', 'reduce non-essential output')
    .showHelpAfterError()
    .addHelpText(
      'after',
      `
Examples:
  $ baton --help
  $ baton --version

V1 implementation note:
  Commands like onboard, brief, pass, status, doctor, and mcp serve are planned
  but not implemented in this bootstrap slice.
`,
    );
}
