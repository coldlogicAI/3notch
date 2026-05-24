import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';

const clients = ['claude-code', 'claude-desktop', 'codex', 'cursor'];
const v2Tools = [
  'get_brief',
  'create_brief',
  'list_briefs',
  'get_targeted_brief',
  'create_packet',
  'import_packet',
  'list_packets',
  'get_packet',
  'create_seed_packet',
  'import_seed_packet',
  'create_mark',
  'create_reply',
  'check_store',
  'get_status',
  'run_doctor',
];
const deferredSurface = ['pass', 'send', 'conflict', 'stale'];

describe('notch prompt', () => {
  it.each(clients)('prints agent instructions for %s', async (client) => {
    const result = await runCli(['prompt', '--client', client]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('3Notch Agent Instructions');

    for (const tool of v2Tools) {
      expect(result.stdout).toContain(tool);
    }

    for (const deferred of deferredSurface) {
      expect(result.stdout.toLowerCase()).not.toMatch(new RegExp(`\\b${deferred}\\b`));
    }
  });

  it('supports JSON output', async () => {
    const result = await runCli(['--json', 'prompt', '--client', 'claude-code']);

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      client: 'claude-code',
      tools: v2Tools,
    });
  });

  it('prints a web-chat packet bridge prompt for claude-chat', async () => {
    const result = await runCli(['prompt', '--client', 'claude-chat']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('3Notch Claude Chat Packet Bridge');
    expect(result.stdout).toContain('YAML frontmatter');
    expect(result.stdout).toContain('purpose: seed');
    expect(result.stdout).toContain('pbpaste | notch packet import -');
    expect(result.stdout).toContain('xclip -selection clipboard -o | notch packet import -');
    expect(result.stdout).toContain('Get-Clipboard | notch packet import -');
  });
});
