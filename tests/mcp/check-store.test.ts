import { describe, expect, it } from 'vitest';

import { createPacket } from '../../src/core/packet-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('MCP check_store', () => {
  it('returns corpus findings through MCP', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'mcp-check-app' });
      const context = await loadConfig({ cwd: project.path });
      await createPacket(context, {
        summary: 'Broken edge.',
        supersedes: 'packet_missing_parent',
        title: 'Broken edge',
        toAgent: 'codex',
      });
      const harness = await createMcpHarness(createNotchMcpServer({ cwd: project.path }));

      try {
        await expect(harness.listTools()).resolves.toContain('check_store');
        const result = await harness.callTool('check_store') as {
          structuredContent: { findings: Array<{ rule: string }>; summary: { errors: number } };
        };

        expect(result.structuredContent.summary.errors).toBe(1);
        expect(result.structuredContent.findings).toEqual([
          expect.objectContaining({ rule: 'CHECK_SUPERSEDES_BROKEN' }),
        ]);
      } finally {
        await harness.close();
      }
    });
  });
});
