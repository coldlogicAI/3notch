import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { readAuditLog } from '../../src/core/audit-service.js';
import { createTargetedBrief, getProjectBrief, getTargetedBrief, listTargetedBriefs } from '../../src/core/brief-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures');

describe('brief service', () => {
  it('reads the default project brief and creates/lists/gets targeted briefs', async () => {
    await withTempProject({ git: true }, async (project) => {
      const storePath = await createBareStore(project.path, { name: 'fixture-app' });
      await writeFile(
        path.join(storePath, 'brief.md'),
        await readFile(path.join(fixturesDir, 'valid-project-brief.md'), 'utf8'),
        'utf8',
      );
      const context = await loadConfig({ cwd: project.path });

      await expect(getProjectBrief(context)).resolves.toMatchObject({
        brief: { recordType: 'project_brief' },
      });

      const created = await createTargetedBrief(context, {
        designBasis: 'The spec defines the service boundary.',
        exclusions: [],
        goal: 'Implement brief service tests.',
        priorReasoningSummary: 'Keep services independent from CLI formatting.',
        recommendedNextSteps: ['Run focused tests'],
        scope: { files: ['src/core/brief-service.ts'], topics: ['briefs'] },
        tags: ['briefs'],
        targetAgent: 'codex',
        title: 'Brief service',
      });

      expect(created.brief.recordType).toBe('brief');
      expect(await listTargetedBriefs(context, { targetAgent: 'codex' })).toHaveLength(1);
      await expect(getTargetedBrief(context, created.brief.id)).resolves.toMatchObject({
        brief: { title: 'Brief service' },
      });
      expect(await readAuditLog(context.paths.logs)).toHaveLength(1);
    });
  });
});
