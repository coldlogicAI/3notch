import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

import { NotchException } from '../types/errors.js';

export type SafePathResult = {
  absolutePath: string;
  relativePath: string;
};

const windowsDrivePattern = /^[a-zA-Z]:[\\/]/;

export function normalizePortablePath(inputPath: string): string {
  return inputPath.replaceAll('\\', '/');
}

export function assertSafeRelativePath(inputPath: string, projectRoot: string): SafePathResult {
  const normalized = normalizePortablePath(inputPath).trim();

  if (
    normalized.length === 0 ||
    normalized.startsWith('~') ||
    normalized.startsWith('/') ||
    path.isAbsolute(normalized) ||
    windowsDrivePattern.test(normalized)
  ) {
    throwPathOutsideProject(inputPath, projectRoot);
  }

  const absolutePath = path.resolve(projectRoot, normalized);
  const relativePath = path.relative(projectRoot, absolutePath);

  if (relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throwPathOutsideProject(inputPath, projectRoot);
  }

  return {
    absolutePath,
    relativePath: relativePath.split(path.sep).join('/'),
  };
}

export function assertSafeDestinationPath(inputPath: string, baseDir: string): SafePathResult {
  if (path.isAbsolute(inputPath) || windowsDrivePattern.test(inputPath) || inputPath.startsWith('~')) {
    throw new NotchException({
      code: 'NOTCH_PATH_OUTSIDE_STORE',
      message: `Destination path is outside the allowed base directory: ${inputPath}`,
      path: inputPath,
      recovery: 'Use a relative destination path inside the allowed directory.',
      severity: 'error',
      exitCode: 5,
    });
  }

  const absolutePath = path.resolve(baseDir, normalizePortablePath(inputPath));
  const relativePath = path.relative(baseDir, absolutePath);

  if (relativePath === '' || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new NotchException({
      code: 'NOTCH_PATH_OUTSIDE_STORE',
      message: `Destination path is outside the allowed base directory: ${inputPath}`,
      path: inputPath,
      recovery: 'Use a relative destination path inside the allowed directory.',
      severity: 'error',
      exitCode: 5,
    });
  }

  return {
    absolutePath,
    relativePath: relativePath.split(path.sep).join('/'),
  };
}

export async function assertNoSymlinksInside(storePath: string): Promise<void> {
  const rootRealPath = await realpath(storePath);

  async function visit(current: string): Promise<void> {
    const stat = await lstat(current);

    if (stat.isSymbolicLink()) {
      throw new NotchException({
        code: 'NOTCH_SYMLINK_REJECTED',
        message: `Symlink inside .notch is not allowed: ${current}`,
        path: current,
        recovery: 'Replace symlinks inside .notch with regular files or directories.',
        severity: 'error',
        exitCode: 5,
      });
    }

    if (!stat.isDirectory()) {
      return;
    }

    const currentRealPath = await realpath(current);

    if (!currentRealPath.startsWith(rootRealPath)) {
      throw new NotchException({
        code: 'NOTCH_SYMLINK_REJECTED',
        message: `Path resolves outside .notch: ${current}`,
        path: current,
        recovery: 'Keep .notch files inside the store directory.',
        severity: 'error',
        exitCode: 5,
      });
    }

    await Promise.all((await readdir(current)).map((entry) => visit(path.join(current, entry))));
  }

  await visit(storePath);
}

export function preserveOriginPathMetadata(inputPath: string): string {
  return inputPath;
}

function throwPathOutsideProject(inputPath: string, projectRoot: string): never {
  throw new NotchException({
    code: 'NOTCH_PATH_OUTSIDE_PROJECT',
    message: `Path must be relative and resolve inside the project root: ${inputPath}`,
    path: inputPath,
    recovery: `Use a path relative to ${projectRoot}.`,
    severity: 'error',
    exitCode: 5,
  });
}
