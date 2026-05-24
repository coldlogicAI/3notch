import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { printInfo, printJson } from '../output.js';
import { claudeChatPromptClient } from '../prompts/claude-chat.js';
import { claudeCodePromptClient } from '../prompts/claude-code.js';
import { claudeDesktopPromptClient } from '../prompts/claude-desktop.js';
import { codexPromptClient } from '../prompts/codex.js';
import { cursorPromptClient } from '../prompts/cursor.js';
import { renderAgentPrompt, v1McpToolNames, type PromptClient, type PromptClientId } from '../prompts/shared.js';
import { NotchException } from '../../types/errors.js';

type PromptOptions = {
  client?: string;
};

const promptClients = new Map<PromptClientId, PromptClient>([
  [claudeChatPromptClient.id, claudeChatPromptClient],
  [claudeCodePromptClient.id, claudeCodePromptClient],
  [claudeDesktopPromptClient.id, claudeDesktopPromptClient],
  [codexPromptClient.id, codexPromptClient],
  [cursorPromptClient.id, cursorPromptClient],
]);

export function registerPromptCommand(program: Command): void {
  program
    .command('prompt')
    .description('print paste-ready agent instructions for a client')
    .requiredOption('--client <client>', 'client: claude-chat, claude-code, claude-desktop, codex, or cursor')
    .action((options: PromptOptions, command: Command) => {
      const context = getCliContext(command);
      const client = resolvePromptClient(options.client);
      const instructions = renderAgentPrompt(client);

      if (context.output.json) {
        printJson({
          client: client.id,
          destination: client.destination,
          instructions,
          tools: v1McpToolNames,
        });
        return;
      }

      printInfo(instructions, context.output);
    });
}

export function promptClientIds(): PromptClientId[] {
  return [...promptClients.keys()];
}

export function renderAgentPromptForClient(clientId: string): string | undefined {
  const client = promptClients.get(clientId as PromptClientId);

  return client ? renderAgentPrompt(client) : undefined;
}

function resolvePromptClient(clientId: string | undefined): PromptClient {
  const client = clientId ? promptClients.get(clientId as PromptClientId) : undefined;

  if (!client) {
    throw new NotchException({
      code: 'NOTCH_CLIENT_UNSUPPORTED',
      message: `Unsupported prompt client: ${clientId ?? 'missing'}.`,
      recovery: `Use one of: ${promptClientIds().join(', ')}.`,
      severity: 'error',
      exitCode: 1,
    });
  }

  return client;
}
