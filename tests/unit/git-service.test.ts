import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

import { readGitSnapshot } from '../../src/core/git-service.js';
import { withTempProject } from '../helpers/temp-project.js';

const execFileAsync = promisify(execFile);

describe('Git snapshot service', () => {
  it('returns a safe empty snapshot outside Git', async () => {
    await withTempProject({}, async (project) => {
      await expect(readGitSnapshot(project.path)).resolves.toEqual({
        changedFiles: [],
        dirty: false,
      });
    });
  });

  it('reports branch, commit, and changed files without losing spaces', async () => {
    await withTempProject({ git: true }, async (project) => {
      await writeFile(path.join(project.path, 'tracked.txt'), 'initial\n', 'utf8');
      await execFileAsync('git', ['add', 'tracked.txt'], { cwd: project.path });
      await execFileAsync('git', ['commit', '-m', 'Initial commit'], { cwd: project.path });
      await writeFile(path.join(project.path, 'tracked.txt'), 'changed\n', 'utf8');
      await writeFile(path.join(project.path, 'file with spaces.txt'), 'new\n', 'utf8');
      const branch = (await execFileAsync('git', ['branch', '--show-current'], { cwd: project.path })).stdout.trim();
      const commit = (await execFileAsync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: project.path })).stdout.trim();

      await expect(readGitSnapshot(project.path)).resolves.toEqual({
        branch,
        changedFiles: ['file with spaces.txt', 'tracked.txt'],
        commit,
        dirty: true,
      });
    });
  });
});
