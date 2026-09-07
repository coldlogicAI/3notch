import { describe, expect, it } from 'vitest';

import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('MCP save_working_state / resume_working_state', () => {
  it('saves and resumes working state without a confirmation step', async () => {
    await withTempProject({ git: true, prefix: 'mcp-save-' }, async (project) => {
      await createBareStore(project.path, { name: 'mcp-save-app' });
      const harness = await createMcpHarness(createNotchMcpServer({ cwd: project.path }));

      try {
        const empty = await harness.callTool('resume_working_state', {}) as {
          structuredContent: { checkpoint: null };
        };
        expect(empty.structuredContent.checkpoint).toBeNull();

        const saved = await harness.callTool('save_working_state', {
          summary: 'MCP wrap-up for the parser.',
          nextSteps: 'Resume and write the remaining tests.',
        }) as { structuredContent: { packet: { id: string; tags: string[] }; stream: string } };
        expect(saved.structuredContent.packet.tags).toEqual(expect.arrayContaining([
          'continuation',
          'source-save',
        ]));

        const resumed = await harness.callTool('resume_working_state', {}) as {
          structuredContent: { checkpoint: { markdown: string; packet: { id: string } } };
        };
        expect(resumed.structuredContent.checkpoint.packet.id).toBe(saved.structuredContent.packet.id);
        expect(resumed.structuredContent.checkpoint.markdown).toContain('MCP wrap-up for the parser.');
        expect(resumed.structuredContent.checkpoint.markdown).toContain('Resume and write the remaining tests.');
      } finally {
        await harness.close();
      }
    });
  });

  it('hides private working state unless the server started with includePrivate', async () => {
    await withTempProject({ git: true, prefix: 'mcp-save-private-' }, async (project) => {
      await createBareStore(project.path, { name: 'mcp-save-private' });
      const writer = await createMcpHarness(createNotchMcpServer({ cwd: project.path }));

      try {
        await writer.callTool('save_working_state', {
          private: true,
          summary: 'Private MCP working state.',
        });
      } finally {
        await writer.close();
      }

      const hidden = await createMcpHarness(createNotchMcpServer({ cwd: project.path }));
      try {
        await expect(hidden.callTool('resume_working_state', { includePrivate: true })).resolves.toMatchObject({
          structuredContent: {
            checkpoint: null,
            warnings: [expect.objectContaining({ code: 'NOTCH_PRIVATE_HIDDEN' })],
          },
        });
      } finally {
        await hidden.close();
      }

      const visible = await createMcpHarness(createNotchMcpServer({
        cwd: project.path,
        includePrivate: true,
      }));
      try {
        await expect(visible.callTool('resume_working_state', { includePrivate: true })).resolves.toMatchObject({
          structuredContent: {
            checkpoint: { markdown: expect.stringContaining('Private MCP working state.') },
          },
        });
      } finally {
        await visible.close();
      }
    });
  });

  it('rejects save_working_state in read-only mode', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'mcp-save-readonly' });
      const harness = await createMcpHarness(createNotchMcpServer({ cwd: project.path, readOnly: true }));

      try {
        await expect(harness.callTool('save_working_state', {
          summary: 'Should not write.',
        })).resolves.toMatchObject({
          isError: true,
          structuredContent: { error: { code: 'NOTCH_MCP_READ_ONLY' } },
        });
      } finally {
        await harness.close();
      }
    });
  });
});
