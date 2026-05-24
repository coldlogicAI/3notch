import { describe, expect, it } from 'vitest';

import { createTargetedBrief } from '../../src/core/brief-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import { createPacket } from '../../src/core/packet-service.js';
import { getStatus } from '../../src/core/status-service.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('status service', () => {
  it('reports counts, open briefs, and packet summaries', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'status-app' });
      const context = await loadConfig({ cwd: project.path });
      await createTargetedBrief(context, {
        designBasis: 'Status service test.',
        exclusions: [],
        goal: 'Report store state.',
        priorReasoningSummary: 'Counts should come from source records.',
        scope: { files: [], topics: ['status'] },
        targetAgent: 'codex',
        title: 'Status work',
      });
      await createPacket(context, {
        summary: 'Packet summary.',
        title: 'Status packet',
        toAgent: 'codex',
      });

      await expect(getStatus(context)).resolves.toMatchObject({
        counts: { targetedBriefs: 1, outboxPackets: 1 },
        openBriefs: [expect.objectContaining({ title: 'Status work' })],
      });
    });
  });
});
