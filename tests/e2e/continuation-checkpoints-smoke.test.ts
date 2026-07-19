import { execFile } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

const execFileAsync = promisify(execFile);

describe('continuation checkpoint e2e', () => {
  it('onboards hooks, captures task progress, survives compaction, and offers resume', async () => {
    await withTempProject({ git: true, prefix: 'notch-continuation-e2e-' }, async (project) => {
      await execFileAsync('git', ['checkout', '-b', 'feature/continuation'], { cwd: project.path });
      const onboard = await runCli([
        'onboard', '--yes', '--mcp', 'claude-code', '--checkpoints', 'prompt', '--name', 'e2e-app',
      ], { cwd: project.path });
      expect(onboard.exitCode).toBe(0);
      expect(onboard.stdout).toContain('may appear in Git');

      const settings = JSON.parse(await readFile(
        path.join(project.path, '.claude/settings.local.json'),
        'utf8',
      )) as { hooks: Record<string, unknown> };
      expect(Object.keys(settings.hooks)).toEqual(expect.arrayContaining([
        'SessionStart', 'TaskCreated', 'TaskCompleted', 'PostCompact', 'StopFailure',
      ]));

      await execFileAsync('git', ['add', '.'], { cwd: project.path });
      const trackedLocalSettings = await execFileAsync(
        'git', ['ls-files', '--', '.claude/settings.local.json'], { cwd: project.path },
      );
      expect(trackedLocalSettings.stdout).toBe('');
      await execFileAsync('git', ['commit', '-m', 'baseline'], { cwd: project.path });
      await writeFile(path.join(project.path, 'working-file.ts'), 'export const unfinished = true;\n');

      for (const input of [
        {
          session_id: 'e2e-writer', cwd: project.path, hook_event_name: 'TaskCreated',
          task_id: 'task-1', task_subject: 'Implement feature', task_description: 'Build the core workflow.',
        },
        {
          session_id: 'e2e-writer', cwd: project.path, hook_event_name: 'TaskCompleted',
          task_id: 'task-1', task_subject: 'Implement feature', task_description: 'Build the core workflow.',
        },
        {
          session_id: 'e2e-writer', cwd: project.path, hook_event_name: 'TaskCreated',
          task_id: 'task-2', task_subject: 'Run verification', task_description: 'Execute the full checks.',
        },
        {
          session_id: 'e2e-writer', cwd: project.path, hook_event_name: 'PostCompact', trigger: 'auto',
          compact_summary: 'Core implementation is complete. Full verification is still pending.',
        },
      ]) {
        const result = await runCli(['hook', 'claude-code'], {
          cwd: project.path,
          input: JSON.stringify({ ...input, transcript_path: '/not-readable.jsonl' }),
        });
        expect(result.exitCode).toBe(0);
      }

      const outbox = await readdir(path.join(project.path, '.notch/outbox'));
      expect(outbox).toHaveLength(1);
      const packetPath = path.join(project.path, '.notch/outbox', outbox[0] ?? '');
      const packet = await readFile(packetPath, 'utf8');
      expect(packet).toContain('stream-feature-continuation');
      expect(packet).toContain('Core implementation is complete');
      expect(packet).toContain('[x] Implement feature');
      expect(packet).toContain('[ ] Run verification');
      expect(packet).toContain('working-file.ts');

      const resume = await runCli(['hook', 'claude-code'], {
        cwd: project.path,
        input: JSON.stringify({
          session_id: 'e2e-reader', cwd: project.path, hook_event_name: 'SessionStart', source: 'startup',
          transcript_path: '/not-readable.jsonl',
        }),
      });
      const resumeOutput = JSON.parse(resume.stdout) as {
        hookSpecificOutput?: { additionalContext?: string };
      };
      expect(resumeOutput.hookSpecificOutput?.additionalContext).toContain('Do not call get_packet');
      expect(resume.stdout).not.toContain('Core implementation is complete');
    });
  });

  it('wires private MCP access and supports confirmation-gated private resume', async () => {
    await withTempProject({ git: true, prefix: 'ncp-' }, async (project) => {
      await execFileAsync('git', ['checkout', '-b', 'main'], { cwd: project.path });
      await runCli([
        'onboard', '--yes', '--mcp', 'claude-code', '--checkpoints', 'prompt', '--name', 'private-e2e',
      ], { cwd: project.path });

      const configPath = path.join(project.path, '.notch/config.json');
      const config = JSON.parse(await readFile(configPath, 'utf8')) as {
        continuation: { sensitivity: string };
      };
      config.continuation.sensitivity = 'private';
      await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

      const resync = await runCli([
        'onboard', '--yes', '--mcp', 'claude-code', '--checkpoints', 'prompt',
      ], { cwd: project.path });
      expect(resync.exitCode).toBe(0);
      expect(resync.stdout).toContain('Private checkpoints enable --include-private');

      const mcpConfig = JSON.parse(await readFile(path.join(project.path, '.mcp.json'), 'utf8')) as {
        mcpServers: { '3notch': { args: string[] } };
      };
      expect(mcpConfig.mcpServers['3notch'].args).toContain('--include-private');

      const checkpoint = await runCli(['hook', 'claude-code'], {
        cwd: project.path,
        input: JSON.stringify({
          session_id: 'private-writer',
          cwd: project.path,
          hook_event_name: 'PostCompact',
          trigger: 'manual',
          compact_summary: 'Private recovery state.',
          transcript_path: '/never-read.jsonl',
        }),
      });
      expect(checkpoint.exitCode).toBe(0);
      expect(checkpoint.stdout).toContain('wrote unreviewed continuation');
      expect(await readdir(path.join(project.path, '.notch/private/outbox'))).toHaveLength(1);
      const offer = await runCli(['hook', 'claude-code'], {
        cwd: project.path,
        input: JSON.stringify({
          session_id: 'private-reader',
          cwd: project.path,
          hook_event_name: 'SessionStart',
          source: 'startup',
          transcript_path: '/never-read.jsonl',
        }),
      });
      expect(offer.stdout).toContain('includePrivate true');
      expect(offer.stdout).not.toContain('Private recovery state.');

      const harness = await createMcpHarness(createNotchMcpServer({
        cwd: project.path,
        includePrivate: true,
      }));

      try {
        const listed = await harness.callTool('list_packets', {
          includePrivate: true,
          tags: ['continuation', 'stream-main'],
        }) as { structuredContent: { packets: Array<{ packet: { id: string; sensitivity: string } }> } };
        expect(listed.structuredContent.packets).toHaveLength(1);
        expect(listed.structuredContent.packets[0]?.packet.sensitivity).toBe('private');

        await expect(harness.callTool('get_packet', {
          id: listed.structuredContent.packets[0]?.packet.id,
          includePrivate: true,
        })).resolves.toMatchObject({
          structuredContent: { packet: { summary: expect.stringContaining('Private recovery state.') } },
        });
      } finally {
        await harness.close();
      }
    });
  });
});
