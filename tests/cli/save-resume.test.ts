import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch save / resume', () => {
  it('saves a continuation from flags and prints it on resume without prompting', async () => {
    await withTempProject({ git: true, prefix: 'notch-save-cli-' }, async (project) => {
      const onboard = await runCli(['onboard', '--yes', '--name', 'save-cli'], { cwd: project.path });
      expect(onboard.exitCode).toBe(0);
      await writeFile(path.join(project.path, 'src-change.ts'), 'export const changed = true;\n');

      const saved = await runCli([
        '--json',
        'save',
        '--summary',
        'Finished the parser slice.',
        '--next-steps',
        'Write the resume tests.',
      ], { cwd: project.path });

      expect(saved.exitCode).toBe(0);
      expect(saved.stderr).toBe('');
      const savedData = JSON.parse(saved.stdout) as {
        packet: { id: string; tags: string[]; summary: string; nextSteps: string };
        stream: string;
      };
      expect(savedData.packet.tags).toEqual(expect.arrayContaining(['continuation', 'source-save']));
      expect(savedData.packet.summary).toContain('Finished the parser slice.');
      expect(savedData.packet.summary).toContain('src-change.ts');
      expect(savedData.packet.nextSteps).toBe('Write the resume tests.');

      const resumed = await runCli(['resume'], { cwd: project.path });
      expect(resumed.exitCode).toBe(0);
      expect(resumed.stderr).toBe('');
      expect(resumed.stdout).toContain('Finished the parser slice.');
      expect(resumed.stdout).toContain('Write the resume tests.');
      expect(resumed.stdout.toLowerCase()).not.toContain('confirm');

      const resumedJson = await runCli(['--json', 'resume'], { cwd: project.path });
      expect(JSON.parse(resumedJson.stdout)).toMatchObject({
        checkpoint: { packet: { id: savedData.packet.id } },
      });
    });
  });

  it('reads summary from stdin and returns none JSON on an empty store', async () => {
    await withTempProject({ git: true, prefix: 'notch-save-stdin-' }, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'save-stdin'], { cwd: project.path });

      const empty = await runCli(['--json', 'resume'], { cwd: project.path });
      expect(empty.exitCode).toBe(0);
      expect(JSON.parse(empty.stdout)).toMatchObject({ checkpoint: null });

      const quiet = await runCli(['resume'], { cwd: project.path });
      expect(quiet.exitCode).toBe(0);
      expect(quiet.stdout).toBe('');
      expect(quiet.stderr).toBe('');

      const saved = await runCli(['--json', 'save'], {
        cwd: project.path,
        input: 'Stdin summary for the next agent.',
      });
      expect(saved.exitCode).toBe(0);
      expect(JSON.parse(saved.stdout)).toMatchObject({
        packet: { summary: expect.stringContaining('Stdin summary for the next agent.') },
      });
    });
  });

  it('blocks secret-bearing save content and hides private packets by default', async () => {
    await withTempProject({ git: true, prefix: 'notch-save-private-' }, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'save-private'], { cwd: project.path });

      const blocked = await runCli([
        '--json',
        'save',
        '--summary',
        'api_key=forbidden-value',
      ], { cwd: project.path });
      expect(blocked.exitCode).toBe(5);
      expect(JSON.parse(blocked.stderr)).toMatchObject({
        error: { code: 'NOTCH_SECRET_DETECTED' },
      });

      const saved = await runCli([
        '--json',
        'save',
        '--private',
        '--summary',
        'Keep this checkpoint off git.',
      ], { cwd: project.path });
      expect(saved.exitCode).toBe(0);
      expect(JSON.parse(saved.stdout)).toMatchObject({
        packet: { sensitivity: 'private' },
      });

      const hidden = await runCli(['--json', 'resume'], { cwd: project.path });
      expect(JSON.parse(hidden.stdout)).toMatchObject({ checkpoint: null });

      const visible = await runCli(['--json', 'resume', '--include-private'], { cwd: project.path });
      expect(JSON.parse(visible.stdout)).toMatchObject({
        checkpoint: { packet: { sensitivity: 'private' } },
      });
    });
  });
});
