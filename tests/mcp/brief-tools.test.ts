import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { readAuditLog } from '../../src/core/audit-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures');

describe('MCP brief tools', () => {
  it('reads the project brief and creates/lists/gets targeted briefs', async () => {
    await withTempProject({}, async (project) => {
      const storePath = await createBareStore(project.path, { name: 'mcp-brief-app' });
      await writeFile(
        path.join(storePath, 'brief.md'),
        await readFile(path.join(fixturesDir, 'valid-project-brief.md'), 'utf8',
        ),
        'utf8',
      );
      const server = createNotchMcpServer({ cwd: project.path });
      const harness = await createMcpHarness(server);

      try {
        await expect(harness.callTool('get_brief', { includeMarkdown: true })).resolves.toMatchObject({
          structuredContent: { brief: { recordType: 'project_brief' } },
        });
        const created = await harness.callTool('create_brief', {
          title: 'MCP brief',
          targetAgent: 'codex',
          goal: 'Exercise MCP brief tool',
          scope: { topics: ['mcp'], files: ['src/mcp/server.ts'] },
          exclusions: [],
          designBasis: 'MCP test',
          priorReasoningSummary: 'No prior reasoning',
        }) as { structuredContent: { brief: { id: string; reviewStatus: string; createdBy: { actorType: string } } } };

        expect(created.structuredContent.brief.createdBy.actorType).toBe('agent');
        expect(created.structuredContent.brief.reviewStatus).toBe('unreviewed');
        await expect(harness.callTool('list_briefs', { targetAgent: 'codex' })).resolves.toMatchObject({
          structuredContent: { briefs: [expect.objectContaining({ title: 'MCP brief' })] },
        });
        await expect(harness.callTool('get_targeted_brief', { id: created.structuredContent.brief.id })).resolves.toMatchObject({
          structuredContent: { brief: { title: 'MCP brief' } },
        });

        const context = await loadConfig({ cwd: project.path });
        expect(await readAuditLog(context.paths.logs)).toHaveLength(1);
      } finally {
        await harness.close();
      }
    });
  });
});
