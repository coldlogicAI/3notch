import { Command } from 'commander';

import { VERSION } from '../core/version.js';
import { registerBriefCommand } from './commands/brief.js';
import { registerCheckCommand } from './commands/check.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerHookCommand } from './commands/hook.js';
import { registerMarkCommand } from './commands/mark.js';
import { registerMcpCommand } from './commands/mcp.js';
import { registerOnboardCommand } from './commands/onboard.js';
import { registerPacketCommand } from './commands/packet.js';
import { registerPromptCommand } from './commands/prompt.js';
import { registerReplyCommand } from './commands/reply.js';
import { registerScanCommand } from './commands/scan.js';
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
  $ notch onboard --yes
  $ notch prompt --client claude-code
  $ notch mark --summary "Remember this project decision"
  $ notch reply <id> --type question --summary "Can you clarify this?"
  $ notch check
  $ notch packet create --title "Auth handoff" --to-agent codex --summary "..." --file src/auth.ts --next-steps "Review auth flow."
  $ notch packet pack <packet-id>
  $ notch packet unpack <packet-id>.notchpkt
  $ notch scan README.md
  $ notch seed from ../old-project --review
  $ notch mcp serve
`,
    );

  registerOnboardCommand(program);
  registerPromptCommand(program);
  registerMarkCommand(program);
  registerReplyCommand(program);
  registerBriefCommand(program);
  registerPacketCommand(program);
  registerSeedCommand(program);
  registerStatusCommand(program);
  registerCheckCommand(program);
  registerDoctorCommand(program);
  registerHookCommand(program);
  registerScanCommand(program);
  registerMcpCommand(program);

  return program;
}
