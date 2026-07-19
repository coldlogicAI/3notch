import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type GitSnapshot = {
  branch?: string;
  changedFiles: string[];
  commit?: string;
  dirty: boolean;
};

export async function readGitSnapshot(cwd: string): Promise<GitSnapshot> {
  const insideWorkTree = await gitOutput(cwd, ['rev-parse', '--is-inside-work-tree']);

  if (insideWorkTree !== 'true') {
    return { changedFiles: [], dirty: false };
  }

  const [branch, commit] = await Promise.all([
    gitOutput(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD']),
    gitOutput(cwd, ['rev-parse', '--short=12', '--verify', 'HEAD']),
  ]);
  const trackedChanges = commit
    ? await gitNullSeparatedOutput(cwd, ['diff', '--name-only', '-z', 'HEAD'])
    : [
        ...await gitNullSeparatedOutput(cwd, ['diff', '--cached', '--name-only', '-z']),
        ...await gitNullSeparatedOutput(cwd, ['diff', '--name-only', '-z']),
      ];
  const untrackedFiles = await gitNullSeparatedOutput(cwd, ['ls-files', '--others', '--exclude-standard', '-z']);
  const changedFiles = [...new Set([...trackedChanges, ...untrackedFiles])].sort();

  return {
    ...(branch ? { branch } : {}),
    changedFiles,
    ...(commit ? { commit } : {}),
    dirty: changedFiles.length > 0,
  };
}

async function gitNullSeparatedOutput(cwd: string, args: string[]): Promise<string[]> {
  try {
    const result = await execFileAsync('git', args, {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
    });

    return result.stdout.split('\0').filter(Boolean);
  } catch {
    return [];
  }
}

async function gitOutput(cwd: string, args: string[]): Promise<string | undefined> {
  try {
    const result = await execFileAsync('git', args, {
      cwd,
      encoding: 'utf8',
      windowsHide: true,
    });
    const value = result.stdout.trim();

    return value || undefined;
  } catch {
    return undefined;
  }
}
