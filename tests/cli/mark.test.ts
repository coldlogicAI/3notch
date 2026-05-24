import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch mark', () => {
  it('writes a self-addressed private packet and records relationship metadata', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'mark-app'], { cwd: project.path });
      const first = await runCli(['--json', 'mark', '--summary', 'Decided to use cookies for auth', '--tags', 'auth,decision'], {
        cwd: project.path,
      });
      const firstData = JSON.parse(first.stdout) as { packet: { id: string }; path: string };

      expect(first.exitCode).toBe(0);
      expect(firstData.path).toContain('.notch/private/inbox');

      const second = await runCli([
        '--json',
        'mark',
        '--summary',
        'Prefer signed cookies over JWT for browser auth',
        '--supersedes',
        firstData.packet.id,
        '--file',
        'src/auth.ts',
      ], { cwd: project.path });
      const secondData = JSON.parse(second.stdout) as { packet: { supersedes: string }; path: string };
      const markdown = await readFile(secondData.path, 'utf8');

      expect(second.exitCode).toBe(0);
      expect(secondData.packet.supersedes).toBe(firstData.packet.id);
      expect(markdown).toContain('purpose: seed');
      expect(markdown).toContain('sensitivity: private');
    });
  });
});
