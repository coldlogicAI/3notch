import type { PromptClient } from './shared.js';

export const claudeChatPromptClient: PromptClient = {
  id: 'claude-chat',
  label: 'Claude Chat',
  destination: 'Claude.ai or Claude desktop chat',
  setupHint: 'Paste this into a web or desktop chat that cannot call the local 3Notch MCP server.',
};
