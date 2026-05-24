import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('e2e onboard MCP config smoke', () => {
  it('writes Claude Code and Claude Desktop MCP configs with injected config home', async () => {
    await withTempProject({ prefix: 'notch-e2e-onboard-' }, async (project) => {
      const configHome = path.join(project.path, 'claude-config-home');
      await mkdir(configHome, { recursive: true });

      const claudeCode = await runCli(['onboard', '--yes', '--mcp', 'claude-code'], {
        cwd: project.path,
      });
      expect(claudeCode.exitCode).toBe(0);

      const claudeDesktop = await runCli(['onboard', '--yes', '--mcp', 'claude-desktop'], {
        cwd: project.path,
        env: { NOTCH_CLAUDE_DESKTOP_CONFIG_HOME: configHome },
      });
      expect(claudeDesktop.exitCode).toBe(0);

      const mcpJson = JSON.parse(await readFile(path.join(project.path, '.mcp.json'), 'utf8')) as {
        mcpServers: Record<string, { args: string[]; command: string }>;
      };
      const desktopJson = JSON.parse(await readFile(path.join(configHome, 'claude_desktop_config.json'), 'utf8')) as {
        mcpServers: Record<string, { args: string[]; command: string }>;
      };

      for (const config of [mcpJson, desktopJson]) {
        expect(config.mcpServers['3notch']).toMatchObject({
          command: 'notch',
          args: ['mcp', 'serve', '--store', expect.stringContaining(path.join(path.basename(project.path), '.notch'))],
        });
      }
    });
  }, 20_000);
});
