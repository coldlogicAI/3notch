import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { NotchException } from '../types/errors.js';

type StoreLockOwner = {
  createdAt: string;
  pid: number;
  token: string;
};

export type StoreLockOptions = {
  orphanGraceMs?: number;
  retryMs?: number;
  timeoutMs?: number;
};

const defaultOptions = {
  orphanGraceMs: 1_000,
  retryMs: 25,
  timeoutMs: 5_000,
} satisfies Required<StoreLockOptions>;

export async function withStoreWriteLock<T>(
  storePath: string,
  operation: () => Promise<T>,
  options: StoreLockOptions = {},
): Promise<T> {
  const release = await acquireStoreWriteLock(storePath, options);

  try {
    return await operation();
  } finally {
    await release();
  }
}

async function acquireStoreWriteLock(
  storePath: string,
  options: StoreLockOptions,
): Promise<() => Promise<void>> {
  const settings = { ...defaultOptions, ...options };
  const logsPath = path.join(storePath, 'logs');
  const lockPath = path.join(logsPath, 'store-write.lock');
  const token = `${process.pid}-${randomUUID()}`;
  const deadline = Date.now() + settings.timeoutMs;

  await mkdir(logsPath, { recursive: true });
  await cleanupAbandonedLocks(logsPath);

  while (true) {
    try {
      await mkdir(lockPath);
      await writeLockOwner(lockPath, token);
      return async () => await releaseStoreWriteLock(lockPath, token);
    } catch (error) {
      if (!isAlreadyExists(error)) {
        throw error;
      }
    }

    if (await recoverAbandonedLock(lockPath, token, settings.orphanGraceMs)) {
      continue;
    }

    if (Date.now() >= deadline) {
      throw new NotchException({
        code: 'NOTCH_STORE_BUSY',
        message: 'Another 3Notch process is writing to this store.',
        path: lockPath,
        recovery: 'Wait for the other command to finish and retry. If it crashed, retry after the abandoned lock is recovered.',
        severity: 'error',
        exitCode: 6,
      });
    }

    await delay(settings.retryMs);
  }
}

async function cleanupAbandonedLocks(logsPath: string): Promise<void> {
  const entries = await readdir(logsPath, { withFileTypes: true }).catch(() => []);
  const abandoned = entries.filter(
    (entry) => entry.isDirectory() && entry.name.startsWith('store-write.lock.abandoned-'),
  );

  await Promise.all(
    abandoned.map(async (entry) => await rm(path.join(logsPath, entry.name), { force: true, recursive: true })),
  );
}

async function writeLockOwner(lockPath: string, token: string): Promise<void> {
  const owner: StoreLockOwner = {
    createdAt: new Date().toISOString(),
    pid: process.pid,
    token,
  };

  await writeFile(path.join(lockPath, 'owner.json'), `${JSON.stringify(owner)}\n`, 'utf8');
}

async function releaseStoreWriteLock(lockPath: string, token: string): Promise<void> {
  const owner = await readLockOwner(lockPath);

  if (owner?.token !== token) {
    return;
  }

  await rm(lockPath, { force: true, recursive: true });
}

async function recoverAbandonedLock(lockPath: string, token: string, orphanGraceMs: number): Promise<boolean> {
  const owner = await readLockOwner(lockPath);

  if (owner && processIsRunning(owner.pid)) {
    return false;
  }

  if (!owner) {
    const lockStat = await stat(lockPath).catch(() => undefined);

    if (!lockStat || Date.now() - lockStat.mtimeMs < orphanGraceMs) {
      return false;
    }
  }

  const abandonedPath = `${lockPath}.abandoned-${token}`;

  try {
    await rename(lockPath, abandonedPath);
  } catch (error) {
    return isMissing(error);
  }

  await rm(abandonedPath, { force: true, recursive: true });
  return true;
}

async function readLockOwner(lockPath: string): Promise<StoreLockOwner | undefined> {
  try {
    const parsed = JSON.parse(await readFile(path.join(lockPath, 'owner.json'), 'utf8')) as Partial<StoreLockOwner>;

    if (
      typeof parsed.createdAt === 'string'
      && Number.isInteger(parsed.pid)
      && typeof parsed.token === 'string'
    ) {
      return parsed as StoreLockOwner;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return isPermissionDenied(error);
  }
}

function isAlreadyExists(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EEXIST';
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function isPermissionDenied(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'EPERM';
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}
