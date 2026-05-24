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
});
