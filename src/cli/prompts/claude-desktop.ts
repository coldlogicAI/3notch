import type { PromptClient } from './shared.js';

export const claudeDesktopPromptClient: PromptClient = {
  id: 'claude-desktop',
  label: 'Claude Desktop',
  destination: 'Claude Desktop project instructions',
  setupHint: 'Claude Desktop should point its 3notch MCP server at this project store.',
};
