import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { createNotchMcpServer } from '../../mcp/server.js';

type McpServeOptions = {
  defaultActor?: string;
  includePrivate?: boolean;
  logFile?: string;
  readOnly?: boolean;
};

export function registerMcpCommand(program: Command): void {
  const mcp = program.command('mcp').description('run the local 3Notch MCP server');

  mcp
    .command('serve')
    .description('serve 3Notch MCP tools over stdio')
    .option('--read-only', 'disable MCP write tools')
    .option('--include-private', 'allow private packet reads for this server process')
    .option('--default-actor <name>', 'default actor name for MCP writes')
    .option('--log-file <path>', 'reserved for diagnostics output')
    .action(async (options: McpServeOptions, command: Command) => {
      const context = getCliContext(command);
      const server = createNotchMcpServer({
        ...(context.cwd ? { cwd: context.cwd } : {}),
        ...(context.store ? { store: context.store } : {}),
        ...(options.defaultActor ? { defaultActor: options.defaultActor } : {}),
        includePrivate: Boolean(options.includePrivate),
        readOnly: Boolean(options.readOnly),
      });
      const transport = new StdioServerTransport();

      await server.connect(transport);
    });
}
