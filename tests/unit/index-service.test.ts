import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { rebuildIndex } from '../../src/core/index-service.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures');

describe('index service', () => {
  it('builds regenerable records and manifest indexes from source files', async () => {
    await withTempProject({}, async (project) => {
      const storePath = await createBareStore(project.path);
      await writeFile(
        path.join(storePath, 'brief.md'),
        await readFile(path.join(fixturesDir, 'valid-project-brief.md'), 'utf8'),
        'utf8',
      );
      await writeFile(
        path.join(storePath, 'inbox/imported.md'),
        await readFile(path.join(fixturesDir, 'valid-packet.md'), 'utf8'),
        'utf8',
      );

      const first = await rebuildIndex(storePath);
      const second = await rebuildIndex(storePath);

      expect(first.records.records).toHaveLength(2);
      expect(first.manifest.recordCount).toBe(2);
      expect(second.records.records.map((record) => record.id).sort()).toEqual(
        first.records.records.map((record) => record.id).sort(),
      );
    });
  });
});
