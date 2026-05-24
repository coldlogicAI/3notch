import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch secret scan integration', () => {
  it('blocks secret-like packet content before writing a record and audits the block', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'secret-guard'], { cwd: project.path });

      const result = await runCli([
        '--json',
        'packet',
        'create',
        '--title',
        'Blocked packet',
        '--summary',
        'api_key=abc123',
        '--to-agent',
        'codex',
      ], { cwd: project.path });

      expect(result.exitCode).toBe(5);
      expect(JSON.parse(result.stderr)).toMatchObject({
        error: { code: 'NOTCH_SECRET_DETECTED' },
      });
      await expect(readdir(path.join(project.path, '.notch/outbox'))).resolves.toEqual([]);

      const auditLines = (await readFile(path.join(project.path, '.notch/logs/audit.jsonl'), 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { errorCode?: string; operation: string; result: string });
      expect(auditLines).toEqual(
        expect.arrayContaining([expect.objectContaining({
          errorCode: 'NOTCH_SECRET_DETECTED',
          operation: 'secret-blocked',
          result: 'blocked',
        })]),
      );
    });
  });
});
