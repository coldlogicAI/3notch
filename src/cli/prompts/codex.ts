import type { PromptClient } from './shared.js';

export const codexPromptClient: PromptClient = {
  id: 'codex',
  label: 'Codex',
  destination: 'AGENTS.md in this repository',
  setupHint: 'Codex should use the configured 3notch MCP server for explicit packet and brief operations.',
};
