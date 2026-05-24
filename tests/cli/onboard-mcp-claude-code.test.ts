import { readFile, writeFile } from 'node:fs/promises';
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
});
