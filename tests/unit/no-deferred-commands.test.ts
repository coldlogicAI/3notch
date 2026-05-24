import { describe, expect, it } from 'vitest';

import { mcpToolInputSchemas } from '../../src/mcp/tool-schemas.js';
import { readRepoFile } from '../helpers/package-inspection.js';

const deferredCliCommands = ['pass', 'send', 'decision', 'question', 'conflict', 'stale'];
const deferredMcpTools = [
  'create_pass',
  'get_latest_pass',
  'get_recent_passes',
  'record_decision',
  'get_decisions',
  'add_open_question',
  'get_open_questions',
  'create_conflict',
  'list_conflicts',
  'resolve_conflict',
  'mark_context_stale',
];

describe('deferred surface guard', () => {
  it('does not register deferred CLI commands', async () => {
    const commandFiles = [
      'src/cli/program.ts',
      'src/cli/commands/brief.ts',
      'src/cli/commands/doctor.ts',
      'src/cli/commands/mcp.ts',
      'src/cli/commands/onboard.ts',
      'src/cli/commands/packet.ts',
      'src/cli/commands/seed.ts',
      'src/cli/commands/status.ts',
    ];
    const combined = (await Promise.all(commandFiles.map(readRepoFile))).join('\n');

    for (const command of deferredCliCommands) {
      expect(combined).not.toMatch(new RegExp(`\\.command\\(['"]${command}['"]`));
    }
  });

  it('does not expose deferred MCP tools', () => {
    const toolNames = Object.keys(mcpToolInputSchemas);

    for (const tool of deferredMcpTools) {
      expect(toolNames).not.toContain(tool);
    }
  });
});
