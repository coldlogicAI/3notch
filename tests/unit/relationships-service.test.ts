import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { createPacket } from '../../src/core/packet-service.js';
import { rebuildRelationshipsIndex } from '../../src/core/relationships-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('relationships service', () => {
  it('builds deterministic packet relationship edges', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'relationship-app' });
      const context = await loadConfig({ cwd: project.path });
      const first = await createPacket(context, {
        sourceLinks: [{ kind: 'file', path: 'src/auth.ts' }],
        summary: 'Original auth handoff.',
        tags: ['auth', 'api'],
        title: 'Original auth',
        toAgent: 'codex',
      });
      const second = await createPacket(context, {
        sourceLinks: [{ kind: 'file', path: 'src/auth.ts' }],
        summary: 'Updated auth handoff.',
        supersedes: first.packet.id,
        tags: ['auth', 'api'],
        title: 'Updated auth',
        toAgent: 'codex',
      });
      const reply = await createPacket(context, {
        purpose: 'seed',
        replyTo: first.packet.id,
        replyType: 'clarification',
        requireRecipient: false,
        sensitivity: 'private',
        summary: 'Clarifying question.',
        title: 'Auth clarification',
      });

      const index = await rebuildRelationshipsIndex(context.storePath);

      expect(index.edges).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'supersedes', from: second.packet.id, to: first.packet.id }),
        expect.objectContaining({ type: 'replyTo', from: reply.packet.id, to: first.packet.id }),
        expect.objectContaining({ type: 'co-tagged', from: first.packet.id, to: second.packet.id }),
        expect.objectContaining({ type: 'co-source-link', from: first.packet.id, to: second.packet.id }),
        expect.objectContaining({ type: 'co-recipient', from: first.packet.id, to: second.packet.id }),
      ]));

      const firstBytes = await readFile(context.paths.relationships, 'utf8');
      await rebuildRelationshipsIndex(context.storePath);
      const secondBytes = await readFile(context.paths.relationships, 'utf8');

      expect(secondBytes).toBe(firstBytes);
    });
  });
});
