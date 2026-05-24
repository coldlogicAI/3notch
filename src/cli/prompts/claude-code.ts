import type { PromptClient } from './shared.js';

export const claudeCodePromptClient: PromptClient = {
  id: 'claude-code',
  label: 'Claude Code',
  destination: 'CLAUDE.md in this repository',
  setupHint: 'Claude Code should use the project-local .mcp.json created by notch onboard --mcp claude-code.',
};
