import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('global CLI flags', () => {
  it('prints JSON errors with documented exit code for missing stores', async () => {
    await withTempProject({}, async (project) => {
      const result = await runCli(['--json', 'status'], { cwd: project.path });

      expect(result.exitCode).toBe(2);
      expect(result.stdout).toBe('');
      expect(JSON.parse(result.stderr)).toMatchObject({
        error: { code: 'NOTCH_STORE_NOT_FOUND', exitCode: 2 },
      });
    });
  });

  it('includes V1 global flags in help', async () => {
    const result = await runCli(['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('--actor <name>');
    expect(result.stdout).toContain('--agent <name>');
    expect(result.stdout).toContain('--source-tool <name>');
    expect(result.stdout).toContain('--no-color');
  });
});
