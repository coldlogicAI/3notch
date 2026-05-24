import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch scan', () => {
  it('exits 0 for clean file content', async () => {
    await withTempProject({}, async (project) => {
      const filePath = path.join(project.path, 'clean.txt');
      await writeFile(filePath, 'Reviewed project context only.\n', 'utf8');

      const result = await runCli(['scan', filePath], { cwd: project.path });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('No sensitive patterns found.');
    });
  });

  it('exits 1 for matching content', async () => {
    await withTempProject({}, async (project) => {
      const filePath = path.join(project.path, 'blocked.txt');
      await writeFile(filePath, 'api_key=abc123\n', 'utf8');

      const result = await runCli(['scan', filePath], { cwd: project.path });

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('Sensitive pattern scan found 1 issue.');
      expect(result.stdout).toContain('api[_-]?key');
    });
  });

  it('supports JSON output from stdin', async () => {
    const result = await runCli(['--json', 'scan', '-'], {
      input: 'tokenvalue ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef012345',
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      clean: false,
      findings: expect.arrayContaining([expect.objectContaining({ pattern: 'token-like' })]),
    });
  });
});
