import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch onboard --mcp claude-code', () => {
  it('writes a project-local .mcp.json and preserves existing servers', async () => {
    await withTempProject({}, async (project) => {
      const configPath = path.join(project.path, '.mcp.json');
      await writeFile(configPath, `${JSON.stringify({
        mcpServers: {
          existing: { command: 'existing-tool', args: ['serve'] },
        },
      }, null, 2)}\n`, 'utf8');

      const result = await runCli(['onboard', '--yes', '--mcp', 'claude-code'], { cwd: project.path });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Configured claude-code MCP server "3notch"');
      expect(result.stdout).toContain('Agent Instructions');

      const config = JSON.parse(await readFile(configPath, 'utf8')) as {
        mcpServers: Record<string, { args: string[]; command: string }>;
      };

      expect(config.mcpServers.existing).toEqual({ command: 'existing-tool', args: ['serve'] });
      expect(config.mcpServers['3notch']).toEqual({
        command: 'notch',
        args: ['mcp', 'serve', '--store', expect.stringContaining(path.join(path.basename(project.path), '.notch'))],
      });
      await expect(readFile(`${configPath}.bak`, 'utf8')).resolves.toContain('existing-tool');
    });
  });

  it('configures continuation policy and preserves unrelated Claude Code hooks', async () => {
    await withTempProject({}, async (project) => {
      const settingsPath = path.join(project.path, '.claude/settings.local.json');
      await mkdir(path.dirname(settingsPath), { recursive: true });
      await writeFile(settingsPath, `${JSON.stringify({
        permissions: { allow: ['Read'] },
        hooks: {
          SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: 'existing-hook' }] }],
        },
      }, null, 2)}\n`, 'utf8');

      const result = await runCli([
        'onboard', '--yes', '--mcp', 'claude-code', '--checkpoints', 'prompt',
      ], { cwd: project.path });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configured Claude Code continuation hooks');
      expect(result.stdout).toContain('may appear in Git');

      const config = JSON.parse(await readFile(path.join(project.path, '.notch/config.json'), 'utf8')) as {
        continuation: {
          claudeCode: { events: string[] };
          mode: string;
          semanticTriggers: string[];
          sensitivity: string;
        };
      };
      expect(config.continuation).toMatchObject({
        mode: 'prompt',
        sensitivity: 'project',
        claudeCode: {
          events: ['SessionStart', 'TaskCreated', 'TaskCompleted', 'PostCompact', 'StopFailure:rate_limit'],
        },
      });
      expect(config.continuation.semanticTriggers).toHaveLength(3);

      const settings = JSON.parse(await readFile(settingsPath, 'utf8')) as {
        hooks: Record<string, Array<{ hooks: Array<{ command: string }>; matcher?: string }>>;
        permissions: { allow: string[] };
      };
      expect(settings.permissions).toEqual({ allow: ['Read'] });
      expect(settings.hooks.SessionStart).toEqual(expect.arrayContaining([
        expect.objectContaining({ hooks: [{ type: 'command', command: 'existing-hook' }] }),
        expect.objectContaining({
          matcher: 'startup|resume|clear|compact',
          hooks: [{ type: 'command', command: 'notch hook claude-code' }],
        }),
      ]));
      expect(settings.hooks.StopFailure).toEqual([
        {
          matcher: 'rate_limit',
          hooks: [{ type: 'command', command: 'notch hook claude-code' }],
        },
      ]);
      await expect(readFile(
        path.join(project.path, '.notch/index/backups/claude-settings.local.json.bak'),
        'utf8',
      )).resolves.toContain('existing-hook');
    });
  });

  it('is idempotent, opts Stop in with a warning, and removes only owned hooks when disabled', async () => {
    await withTempProject({}, async (project) => {
      const settingsPath = path.join(project.path, '.claude/settings.local.json');
      await mkdir(path.dirname(settingsPath), { recursive: true });
      await writeFile(settingsPath, `${JSON.stringify({
        hooks: {
          Stop: [{ hooks: [{ type: 'command', command: 'keep-me' }] }],
        },
      }, null, 2)}\n`, 'utf8');

      const args = ['onboard', '--yes', '--mcp', 'claude-code', '--checkpoints', 'auto', '--checkpoint-stop'];
      const first = await runCli(args, { cwd: project.path });
      const afterFirst = await readFile(settingsPath, 'utf8');
      const second = await runCli(args, { cwd: project.path });

      expect(first.exitCode).toBe(0);
      expect(first.stdout).toContain('Stop fires after every Claude response');
      expect(second.exitCode).toBe(0);
      expect(second.stdout).not.toContain('Configured Claude Code continuation hooks');
      expect(await readFile(settingsPath, 'utf8')).toBe(afterFirst);

      const disabled = await runCli([
        'onboard', '--yes', '--mcp', 'claude-code', '--checkpoints', 'off',
      ], { cwd: project.path });
      expect(disabled.exitCode).toBe(0);

      const settings = JSON.parse(await readFile(settingsPath, 'utf8')) as {
        hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
      };
      expect(settings.hooks.Stop).toEqual([{ hooks: [{ type: 'command', command: 'keep-me' }] }]);
      expect(JSON.stringify(settings)).not.toContain('notch hook claude-code');

      const config = JSON.parse(await readFile(path.join(project.path, '.notch/config.json'), 'utf8')) as {
        continuation: { mode: string };
      };
      expect(config.continuation.mode).toBe('off');
    });
  });

  it('removes the owned Stop hook when checkpoint-stop is omitted on resync', async () => {
    await withTempProject({}, async (project) => {
      const enabled = await runCli([
        'onboard', '--yes', '--mcp', 'claude-code', '--checkpoints', 'prompt', '--checkpoint-stop',
      ], { cwd: project.path });
      expect(enabled.exitCode).toBe(0);

      const resynced = await runCli([
        'onboard', '--yes', '--mcp', 'claude-code', '--checkpoints', 'prompt',
      ], { cwd: project.path });
      expect(resynced.exitCode).toBe(0);

      const config = JSON.parse(await readFile(path.join(project.path, '.notch/config.json'), 'utf8')) as {
        continuation: { claudeCode: { events: string[] } };
      };
      const settings = JSON.parse(await readFile(path.join(project.path, '.claude/settings.local.json'), 'utf8')) as {
        hooks: Record<string, unknown>;
      };

      expect(config.continuation.claudeCode.events).not.toContain('Stop');
      expect(settings.hooks.Stop).toBeUndefined();
    });
  });

  it('rejects malformed Claude settings without rewriting them', async () => {
    await withTempProject({}, async (project) => {
      const settingsPath = path.join(project.path, '.claude/settings.local.json');
      await mkdir(path.dirname(settingsPath), { recursive: true });
      const malformed = '{ "hooks": ';
      await writeFile(settingsPath, malformed, 'utf8');

      const result = await runCli([
        'onboard', '--yes', '--mcp', 'claude-code', '--checkpoints', 'script',
      ], { cwd: project.path });

      expect(result.exitCode).toBe(3);
      expect(result.stderr).toContain('NOTCH_CLAUDE_SETTINGS_INVALID');
      expect(await readFile(settingsPath, 'utf8')).toBe(malformed);
      await expect(readFile(
        path.join(project.path, '.notch/index/backups/claude-settings.local.json.bak'),
        'utf8',
      )).rejects.toThrow();
    });
  });
});
