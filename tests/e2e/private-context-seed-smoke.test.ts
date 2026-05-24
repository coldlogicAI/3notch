import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('e2e private context seed smoke', () => {
  it('imports private seed context and hides it from MCP unless includePrivate is set', async () => {
    await withTempProject({ prefix: 'notch-e2e-old-' }, async (oldProject) => {
      await withTempProject({ prefix: 'notch-e2e-new-' }, async (newProject) => {
        await runCli(['onboard', '--yes', '--name', 'old-app'], { cwd: oldProject.path });
        await runCli(['onboard', '--yes', '--name', 'new-app'], { cwd: newProject.path });
        await writeFile(path.join(oldProject.path, '.notch/brief.md'), `---
id: project_brief_old_app
schemaVersion: "1.0.0"
recordType: project_brief
status: active
projectName: old-app
createdAt: 2026-05-24T00:00:00Z
createdBy:
  actorType: human
  name: Test User
sourceTool:
  name: notch-cli
tags: []
sourceLinks: []
reviewStatus: reviewed
currentFocus:
  - Carry private workflow context forward.
activeConstraints:
  - Keep seed context private.
recentActivity: []
openThreads:
  - Review seed context before use.
warnings: []
---

## Current Focus

- Carry private workflow context forward.

## Active Constraints

- Keep seed context private.

## Recent Activity

- None.

## Open Threads

- Review seed context before use.

## Warnings

- None.
`, 'utf8');
        const editor = path.join(newProject.path, 'fake-editor.cjs');
        await writeFile(editor, `const fs = require('fs');\nfs.appendFileSync(process.argv[2], '\\n\\nReviewed in e2e.\\n');\n`, 'utf8');

        const seed = await runCli(['--json', 'seed', 'from', oldProject.path, '--review'], {
          cwd: newProject.path,
          env: { EDITOR: `${process.execPath} ${editor}` },
        });
        expect(seed.exitCode).toBe(0);
        expect(JSON.parse(seed.stdout)).toMatchObject({ inboxPath: expect.stringContaining('.notch/private/inbox') });

        const hiddenHarness = await createMcpHarness(createNotchMcpServer({ cwd: newProject.path }));
        try {
          await expect(hiddenHarness.callTool('list_packets', { includePrivate: true, purpose: 'seed' })).resolves.toMatchObject({
            structuredContent: { packets: [], warnings: [expect.objectContaining({ code: 'NOTCH_PRIVATE_HIDDEN' })] },
          });
        } finally {
          await hiddenHarness.close();
        }

        const privateHarness = await createMcpHarness(createNotchMcpServer({ cwd: newProject.path, includePrivate: true }));
        try {
          const visible = await privateHarness.callTool('list_packets', { includePrivate: true, purpose: 'seed' }) as {
            structuredContent: { packets: Array<{ packet: { purpose: string } }> };
          };
          expect(visible.structuredContent.packets).toEqual(
            expect.arrayContaining([expect.objectContaining({ packet: expect.objectContaining({ purpose: 'seed' }) })]),
          );
        } finally {
          await privateHarness.close();
        }
      });
    });
  }, 20_000);
});
