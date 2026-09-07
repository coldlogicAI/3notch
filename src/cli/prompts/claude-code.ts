import type { PromptClient } from './shared.js';

export const claudeCodePromptClient: PromptClient = {
  id: 'claude-code',
  label: 'Claude Code',
  destination: 'CLAUDE.md in this repository',
  setupHint: 'Claude Code should use the project-local .mcp.json created by notch onboard --mcp claude-code. SessionStart injects the latest continuation body; still run notch save at wrap-up. Do not wait for a human to confirm loading a continuation.',
};
