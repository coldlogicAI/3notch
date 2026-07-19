import { mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { withStoreWriteLock } from '../../src/core/store-lock-service.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('store write lock', () => {
  it('times out while another live process owns the lock', async () => {
    await withTempProject({ prefix: 'notch-live-lock-' }, async (project) => {
      const storePath = path.join(project.path, '.notch');
      const lockPath = path.join(storePath, 'logs/store-write.lock');
      await mkdir(lockPath, { recursive: true });
      await writeFile(path.join(lockPath, 'owner.json'), `${JSON.stringify({
        createdAt: new Date().toISOString(),
        pid: process.pid,
        token: 'live-owner',
      })}\n`, 'utf8');

      await expect(withStoreWriteLock(
        storePath,
        async () => undefined,
        { retryMs: 5, timeoutMs: 25 },
      )).rejects.toMatchObject({ notchError: { code: 'NOTCH_STORE_BUSY' } });
    });
  });

  it('recovers a lock left by a dead process', async () => {
    await withTempProject({ prefix: 'notch-abandoned-lock-' }, async (project) => {
      const storePath = path.join(project.path, '.notch');
      const lockPath = path.join(storePath, 'logs/store-write.lock');
      await mkdir(lockPath, { recursive: true });
      await writeFile(path.join(lockPath, 'owner.json'), `${JSON.stringify({
        createdAt: new Date().toISOString(),
        pid: 2_147_483_647,
        token: 'dead-owner',
      })}\n`, 'utf8');

      const result = await withStoreWriteLock(storePath, async () => 'recovered');

      expect(result).toBe('recovered');
    });
  });

  it('cleans abandoned lock remnants from earlier crashes', async () => {
    await withTempProject({ prefix: 'notch-abandoned-remnant-' }, async (project) => {
      const storePath = path.join(project.path, '.notch');
      const logsPath = path.join(storePath, 'logs');
      await mkdir(path.join(logsPath, 'store-write.lock.abandoned-old-process'), { recursive: true });

      await withStoreWriteLock(storePath, async () => undefined);

      expect(await readdir(logsPath)).not.toContain('store-write.lock.abandoned-old-process');
    });
  });
});
