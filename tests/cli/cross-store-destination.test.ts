import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch cross-store destination guard', () => {
  it('rejects packet import destinations without a .notch/config.json', async () => {
    await withTempProject({ prefix: 'notch-source-' }, async (source) => {
      await withTempProject({ prefix: 'notch-uninitialized-dest-' }, async (destination) => {
        await runCli(['onboard', '--yes', '--name', 'source-app'], { cwd: source.path });
        const created = await runCli([
          '--json',
          'packet',
          'create',
          '--title',
          'Destination guard',
          '--summary',
          'This packet should not import into an uninitialized destination.',
          '--to-agent',
          'codex',
        ], { cwd: source.path });
        const { outboxPath } = JSON.parse(created.stdout) as { outboxPath: string };

        const result = await runCli(['--json', 'packet', 'import', outboxPath, '--into', destination.path], {
          cwd: source.path,
        });

        expect(result.exitCode).toBe(2);
        expect(JSON.parse(result.stderr)).toMatchObject({
          error: { code: 'NOTCH_STORE_NOT_FOUND' },
        });
      });
    });
  });
});
