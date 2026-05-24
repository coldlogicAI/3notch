import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type TempProject = {
  path: string;
  cleanup: () => Promise<void>;
};

export type CreateTempProjectOptions = {
  git?: boolean;
  prefix?: string;
};

export async function createTempProject(
  options: CreateTempProjectOptions = {},
): Promise<TempProject> {
  const prefix = options.prefix ?? 'notch-test-';
  const projectPath = await mkdtemp(path.join(os.tmpdir(), prefix));

  if (options.git) {
    await execFileAsync('git', ['init'], { cwd: projectPath });
    await execFileAsync('git', ['config', 'user.name', '3Notch Test'], { cwd: projectPath });
    await execFileAsync('git', ['config', 'user.email', 'test@example.invalid'], {
      cwd: projectPath,
    });
  }

  return {
    path: projectPath,
    cleanup: async () => {
      await rm(projectPath, { force: true, recursive: true });
    },
  };
}

export async function withTempProject<T>(
  options: CreateTempProjectOptions,
  callback: (project: TempProject) => Promise<T>,
): Promise<T> {
  const project = await createTempProject(options);

  try {
    return await callback(project);
  } finally {
    await project.cleanup();
  }
}
