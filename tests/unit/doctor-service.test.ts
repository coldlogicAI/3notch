import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/core/config-service.js';
import { runDoctor } from '../../src/core/doctor-service.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures');

describe('doctor service', () => {
  it('reports a fresh store as healthy and can rebuild derived indexes', async () => {
    await withTempProject({}, async (project) => {
      const storePath = await createBareStore(project.path, { name: 'doctor-app' });
      await writeFile(
        path.join(storePath, 'brief.md'),
        await readFile(path.join(fixturesDir, 'valid-project-brief.md'), 'utf8'),
        'utf8',
      );
      const context = await loadConfig({ cwd: project.path });
      const result = await runDoctor(context, { fix: true });

      expect(result.healthy).toBe(true);
      expect(result.checks).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'NOTCH_INDEX_REBUILT' })]));
    });
  });

  it('reports corrupt records', async () => {
    await withTempProject({}, async (project) => {
      const storePath = await createBareStore(project.path, { name: 'doctor-app' });
      await writeFile(path.join(storePath, 'outbox/bad.md'), await readFile(path.join(fixturesDir, 'bad-yaml.md'), 'utf8'), 'utf8');
      const context = await loadConfig({ cwd: project.path });
      const result = await runDoctor(context);

      expect(result.healthy).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'NOTCH_RECORD_INVALID' })]));
    });
  });
});
