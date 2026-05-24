import type { PromptClient } from './shared.js';

export const cursorPromptClient: PromptClient = {
  id: 'cursor',
  label: 'Cursor',
  destination: '.cursor/rules/3notch.mdc or the project rules file you already use',
  setupHint: 'Cursor should use the project MCP server definition that points at this .notch store.',
};
