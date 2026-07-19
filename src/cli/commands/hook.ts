import type { Command } from 'commander';

import { runClaudeCodeHook } from '../../core/continuation-service.js';

export function registerHookCommand(program: Command): void {
  const hook = program
    .command('hook')
    .description('run an installed client lifecycle hook');

  hook
    .command('claude-code')
    .description('process one Claude Code hook JSON object from stdin')
    .action(async () => {
      const input = await readStdin();
      let parsed: unknown;

      try {
        parsed = input.trim().length > 0 ? JSON.parse(input) as unknown : {};
      } catch (error) {
        process.stdout.write(`${JSON.stringify({
          systemMessage: `3Notch continuation hook skipped: ${error instanceof Error ? error.message : String(error)}`,
        })}\n`);
        return;
      }

      const output = await runClaudeCodeHook(parsed);
      process.stdout.write(`${JSON.stringify(output)}\n`);
    });
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  return Buffer.concat(chunks).toString('utf8');
}
