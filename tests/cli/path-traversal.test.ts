import { symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch path traversal guard', () => {
  it('rejects sibling traversal in scoped brief files', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'path-guard'], { cwd: project.path });

      const result = await runCli([
        '--json',
        'brief',
        'create',
        '--title',
        'Unsafe path',
        '--to',
        'codex',
        '--goal',
        'Reject sibling traversal.',
        '--file',
        '../outside.md',
      ], { cwd: project.path });

      expect(result.exitCode).toBe(5);
      expect(JSON.parse(result.stderr)).toMatchObject({
        error: { code: 'NOTCH_PATH_OUTSIDE_PROJECT' },
      });
    });
  });

  it('rejects absolute packet source paths', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'absolute-guard'], { cwd: project.path });

      const result = await runCli([
        '--json',
        'packet',
        'create',
        '--title',
        'Unsafe packet',
        '--summary',
        'Reject absolute source paths.',
        '--to-agent',
        'codex',
        '--file',
        path.join(project.path, 'src/index.ts'),
      ], { cwd: project.path });

      expect(result.exitCode).toBe(5);
      expect(JSON.parse(result.stderr)).toMatchObject({
        error: { code: 'NOTCH_PATH_OUTSIDE_PROJECT' },
      });
    });
  });

  it('rejects packet output paths outside the project root', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'output-guard'], { cwd: project.path });

      for (const outputPath of ['../escape.md', path.join(project.path, '../abs-escape.md')]) {
        const result = await runCli([
          '--json',
          'packet',
          'create',
          '--title',
          'Escaping packet',
          '--summary',
          'Reject escaping output path.',
          '--to-agent',
          'codex',
          '--out',
          outputPath,
        ], { cwd: project.path });

        expect(result.exitCode).toBe(5);
        expect(JSON.parse(result.stderr)).toMatchObject({
          error: { code: 'NOTCH_PATH_OUTSIDE_PROJECT' },
        });
      }
    });
  });

  it.skipIf(process.platform === 'win32')('reports symlinks inside .notch during doctor', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'symlink-guard'], { cwd: project.path });
      const outside = path.join(project.path, 'outside.md');
      await writeFile(outside, '# Outside\n', 'utf8');
      await symlink(outside, path.join(project.path, '.notch/inbox/outside.md'));

      const result = await runCli(['--json', 'doctor'], { cwd: project.path });

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        checks: expect.arrayContaining([expect.objectContaining({ code: 'NOTCH_SYMLINK_REJECTED' })]),
      });
    });
  });
});
