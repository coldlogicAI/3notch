import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';
import { createSeedPacket, importSeedPacket, seedFrom } from '../../src/core/seed-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import { listPackets } from '../../src/core/packet-service.js';

describe('seed service', () => {
  it('creates and imports private seed packets into private inbox', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'new-app' });
      const context = await loadConfig({ cwd: project.path });
      const created = await createSeedPacket(context, {
        summary: 'Reviewed workflow conventions.',
        title: 'Workflow seed',
      });
      const imported = await importSeedPacket(context, created.outboxPath, { asReviewed: true });

      expect(created.outboxPath).toContain('.notch/private/outbox');
      expect(imported.inboxPath).toContain('.notch/private/inbox');
      expect(await listPackets(context, { includePrivate: false, purpose: 'seed' })).toHaveLength(0);
      expect(await listPackets(context, { includePrivate: true, purpose: 'seed' })).toHaveLength(2);
    });
  });

  it('rejects non-reviewed private context seeding', async () => {
    await withTempProject({}, async (oldProject) => {
      await withTempProject({}, async (newProject) => {
        await createBareStore(oldProject.path, { name: 'old-app' });
        await createBareStore(newProject.path, { name: 'new-app' });
        const context = await loadConfig({ cwd: newProject.path });

        await expect(seedFrom(context, { sourcePath: oldProject.path })).rejects.toMatchObject({
          notchError: { code: 'NOTCH_SEED_REVIEW_REQUIRED' },
        });
      });
    });
  });

  it('rejects reviewed seeding when requested categories have no source content', async () => {
    await withTempProject({}, async (oldProject) => {
      await withTempProject({}, async (newProject) => {
        await createBareStore(oldProject.path, { name: 'old-app' });
        await createBareStore(newProject.path, { name: 'new-app' });
        const context = await loadConfig({ cwd: newProject.path });

        await expect(seedFrom(context, {
          include: ['preferences'],
          review: true,
          reviewer: async (draft) => `${draft}\n\nReviewed by test.\n`,
          sourcePath: oldProject.path,
        })).rejects.toMatchObject({
          notchError: { code: 'NOTCH_SEED_NO_CONTENT' },
        });
      });
    });
  });

  it('carries selected source file references without reading file bodies', async () => {
    await withTempProject({}, async (oldProject) => {
      await withTempProject({}, async (newProject) => {
        await createBareStore(oldProject.path, { name: 'old-app' });
        await createBareStore(newProject.path, { name: 'new-app' });
        const context = await loadConfig({ cwd: newProject.path });

        const imported = await seedFrom(context, {
          files: ['docs/preferences.md'],
          review: true,
          reviewer: async (draft) => `${draft}\n\nReviewed by test.\n`,
          sourcePath: oldProject.path,
        });

        const shown = await readFile(imported.inboxPath, 'utf8');
        expect(shown).toContain('docs/preferences.md');
      });
    });
  });

  it('rejects unsafe selected seed file references', async () => {
    await withTempProject({}, async (oldProject) => {
      await withTempProject({}, async (newProject) => {
        await createBareStore(oldProject.path, { name: 'old-app' });
        await createBareStore(newProject.path, { name: 'new-app' });
        const context = await loadConfig({ cwd: newProject.path });

        await expect(seedFrom(context, {
          files: ['../outside.md'],
          review: true,
          reviewer: async (draft) => `${draft}\n\nReviewed by test.\n`,
          sourcePath: oldProject.path,
        })).rejects.toMatchObject({
          notchError: { code: 'NOTCH_PATH_OUTSIDE_PROJECT' },
        });
      });
    });
  });

  it('carries reviewed source brief content into the seed packet body', async () => {
    await withTempProject({}, async (oldProject) => {
      await withTempProject({}, async (newProject) => {
        const oldStore = await createBareStore(oldProject.path, { name: 'old-app' });
        await createBareStore(newProject.path, { name: 'new-app' });
        await writeFile(path.join(oldStore, 'brief.md'), `## Current Focus

- Prefer source-linked implementation notes.

## Active Constraints

- Verify before local commits.

## Open Threads

- Carry forward only reviewed context.
`, 'utf8');
        const context = await loadConfig({ cwd: newProject.path });

        const imported = await seedFrom(context, {
          review: true,
          reviewer: async (draft) => `${draft}\n\nReviewed by test.\n`,
          sourcePath: oldProject.path,
        });

        const shown = await readFile(imported.inboxPath, 'utf8');
        expect(shown).toContain('Prefer source-linked implementation notes.');
        expect(shown).toContain('Verify before local commits.');
        expect(shown).toContain('Carry forward only reviewed context.');
        expect(shown).toContain('Reviewed by test.');
      });
    });
  });
});
