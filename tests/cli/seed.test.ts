import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch seed', () => {
  it('requires review for private context seeding', async () => {
    await withTempProject({}, async (oldProject) => {
      await withTempProject({}, async (newProject) => {
        await runCli(['onboard', '--yes', '--name', 'old-app'], { cwd: oldProject.path });
        await runCli(['onboard', '--yes', '--name', 'new-app'], { cwd: newProject.path });

        const result = await runCli(['seed', 'from', oldProject.path], { cwd: newProject.path });

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('NOTCH_SEED_REVIEW_REQUIRED');
      });
    });
  });

  it('imports reviewed private context into the private inbox', async () => {
    await withTempProject({}, async (oldProject) => {
      await withTempProject({}, async (newProject) => {
        await runCli(['onboard', '--yes', '--name', 'old-app'], { cwd: oldProject.path });
        await runCli(['onboard', '--yes', '--name', 'new-app'], { cwd: newProject.path });
        await writeSourceBrief(oldProject.path);
        const editor = await writeFakeEditor(newProject.path, '\n\nEdited during review.\n');

        const result = await runCli(['--json', 'seed', 'from', oldProject.path, '--review'], {
          cwd: newProject.path,
          env: { EDITOR: `${process.execPath} ${editor}` },
        });

        expect(result.exitCode).toBe(0);
        const imported = JSON.parse(result.stdout) as { packet: { id: string }; inboxPath: string };
        expect(imported).toMatchObject({
          inboxPath: expect.stringContaining('.notch/private/inbox'),
        });
        const shown = await runCli(['packet', 'show', imported.packet.id, '--private', '--inbox'], {
          cwd: newProject.path,
        });
        expect(shown.stdout).toContain('Prefer short implementation logs.');
        expect(shown.stdout).toContain('Edited during review.');

        const hidden = await runCli(['--json', 'packet', 'list', '--purpose', 'seed'], {
          cwd: newProject.path,
        });
        expect(JSON.parse(hidden.stdout)).toMatchObject({ packets: [] });

        const visible = await runCli(['--json', 'packet', 'list', '--purpose', 'seed', '--private'], {
          cwd: newProject.path,
        });
        expect(JSON.parse(visible.stdout).packets.length).toBeGreaterThan(0);
      });
    });
  });
});

async function writeSourceBrief(projectPath: string): Promise<void> {
  await writeFile(path.join(projectPath, '.notch/brief.md'), `---
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
  - Prefer short implementation logs.
activeConstraints:
  - Verify before committing.
recentActivity: []
openThreads:
  - Carry forward source-linked context.
warnings: []
---

## Current Focus

- Prefer short implementation logs.

## Active Constraints

- Verify before committing.

## Recent Activity

- None.

## Open Threads

- Carry forward source-linked context.

## Warnings

- None.
`, 'utf8');
}

async function writeFakeEditor(projectPath: string, text: string): Promise<string> {
  const scriptPath = path.join(projectPath, 'fake-editor.cjs');
  await writeFile(scriptPath, `const fs = require('fs');\nfs.appendFileSync(process.argv[2], ${JSON.stringify(text)});\n`, 'utf8');
  return scriptPath;
}
