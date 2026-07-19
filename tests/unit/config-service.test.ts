import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../src/core/config-service.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('config service', () => {
  it('loads a valid .notch config from the project root', async () => {
    await withTempProject({ git: true }, async (project) => {
      await createBareStore(project.path, { name: 'fixture-app' });

      const loaded = await loadConfig({ cwd: project.path });

      expect(loaded.config.project.name).toBe('fixture-app');
      expect(loaded.config.privacy.telemetry).toBe(false);
      expect(loaded.storePath).toBe(path.join(project.path, '.notch'));
    });
  });

  it('maps missing stores to NOTCH_STORE_NOT_FOUND and exit code 2', async () => {
    await withTempProject({}, async (project) => {
      await expect(loadConfig({ cwd: project.path })).rejects.toMatchObject({
        notchError: { code: 'NOTCH_STORE_NOT_FOUND', exitCode: 2 },
      });
    });
  });

  it('prefers a nested .notch store over an outer Git root', async () => {
    await withTempProject({ git: true }, async (project) => {
      const nested = path.join(project.path, 'fixtures/nested-app');
      await mkdir(nested, { recursive: true });
      await createBareStore(nested, { name: 'nested-app' });

      const loaded = await loadConfig({ cwd: nested });

      expect(loaded.projectRoot).toBe(nested);
      expect(loaded.storePath).toBe(path.join(nested, '.notch'));
      expect(loaded.config.project.name).toBe('nested-app');
    });
  });

  it('warns on unknown top-level config fields while still loading the config', async () => {
    await withTempProject({}, async (project) => {
      const storePath = await createBareStore(project.path, { name: 'fixture-app' });
      const configPath = path.join(storePath, 'config.json');
      const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>;
      config.futureField = true;
      await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

      const loaded = await loadConfig({ cwd: project.path });

      expect(loaded.warnings).toEqual([
        expect.objectContaining({ code: 'NOTCH_CONFIG_UNKNOWN_FIELD', field: '/futureField' }),
      ]);
    });
  });

  it('treats missing continuation config as off and recognizes an explicit continuation policy', async () => {
    await withTempProject({}, async (project) => {
      const storePath = await createBareStore(project.path, { name: 'fixture-app' });
      const withoutPolicy = await loadConfig({ cwd: project.path });

      expect(withoutPolicy.config.continuation).toBeUndefined();
      expect(withoutPolicy.warnings).toEqual([]);

      const configPath = path.join(storePath, 'config.json');
      const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>;
      config.continuation = {
        mode: 'script',
        sensitivity: 'project',
        semanticTriggers: [],
        claudeCode: { events: ['PostCompact'] },
      };
      await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');

      const withPolicy = await loadConfig({ cwd: project.path });
      expect(withPolicy.config.continuation?.mode).toBe('script');
      expect(withPolicy.warnings).toEqual([]);
    });
  });
});
