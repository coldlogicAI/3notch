import type { PromptClient } from './shared.js';

export const codexPromptClient: PromptClient = {
  id: 'codex',
  label: 'Codex',
  destination: 'AGENTS.md in this repository',
  setupHint: 'Codex should use the configured 3notch MCP server. At wrap-up run notch save; at session start run notch resume. Do not wait for a human to confirm loading a continuation.',
};
