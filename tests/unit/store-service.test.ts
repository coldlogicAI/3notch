import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { scanMarkdownRecords, writeRecordWithCollisionHandling } from '../../src/core/store-service.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures');

describe('store service', () => {
  it('writes records atomically and auto-suffixes generated slug collisions', async () => {
    await withTempProject({}, async (project) => {
      const storePath = await createBareStore(project.path);
      const packet = await readFile(path.join(fixturesDir, 'valid-packet.md'), 'utf8');
      const first = await writeRecordWithCollisionHandling(storePath, {
        content: packet,
        directory: path.join(storePath, 'outbox'),
        slug: 'packet',
      });
      const second = await writeRecordWithCollisionHandling(storePath, {
        content: packet,
        directory: path.join(storePath, 'outbox'),
        slug: 'packet',
      });

      expect(path.basename(first.path)).toBe('packet.md');
      expect(path.basename(second.path)).toBe('packet-2.md');

      const records = await scanMarkdownRecords(storePath);
      expect(records.filter((record) => record.ok)).toHaveLength(2);
    });
  });

  it('fails explicit slug collisions', async () => {
    await withTempProject({}, async (project) => {
      const storePath = await createBareStore(project.path);
      const packet = await readFile(path.join(fixturesDir, 'valid-packet.md'), 'utf8');
      await writeRecordWithCollisionHandling(storePath, {
        content: packet,
        directory: path.join(storePath, 'outbox'),
        explicitSlug: true,
        slug: 'packet',
      });

      await expect(
        writeRecordWithCollisionHandling(storePath, {
          content: packet,
          directory: path.join(storePath, 'outbox'),
          explicitSlug: true,
          slug: 'packet',
        }),
      ).rejects.toMatchObject({ notchError: { code: 'NOTCH_WRITE_FAILED' } });
    });
  });
});
