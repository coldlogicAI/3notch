import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures');

describe('MCP server foundation', () => {
  it('initializes and lists exactly the shipped tools', async () => {
    await withTempProject({}, async (project) => {
      const storePath = await createBareStore(project.path, { name: 'mcp-app' });
      await writeFile(
        path.join(storePath, 'brief.md'),
        await readFile(path.join(fixturesDir, 'valid-project-brief.md'), 'utf8'),
        'utf8',
      );
      const server = createNotchMcpServer({ cwd: project.path });
      const harness = await createMcpHarness(server);

      try {
        const tools = await harness.listTools();
        expect(tools.sort()).toEqual([
          'check_store',
          'create_brief',
          'create_mark',
          'create_packet',
          'create_reply',
          'create_seed_packet',
          'get_brief',
          'get_packet',
          'get_status',
          'get_targeted_brief',
          'import_packet',
          'import_seed_packet',
          'list_briefs',
          'list_packets',
          'run_doctor',
        ].sort());
        expect(tools).not.toContain('create_pass');
        await expect(harness.client.ping()).resolves.toEqual({});
      } finally {
        await harness.close();
      }
    });
  });
});
