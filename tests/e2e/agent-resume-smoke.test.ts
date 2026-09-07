import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

import { createNotchMcpServer } from '../../src/mcp/server.js';
import { createMcpHarness } from '../helpers/mcp-harness.js';
import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

const execFileAsync = promisify(execFile);

describe('agent save/resume e2e', () => {
  it('saves working state, resumes it, and injects the body on SessionStart', async () => {
    await withTempProject({ git: true, prefix: 'notch-agent-resume-' }, async (project) => {
      await execFileAsync('git', ['checkout', '-b', 'feature/resume'], { cwd: project.path });
      const onboard = await runCli([
        'onboard', '--yes', '--mcp', 'claude-code', '--checkpoints', 'script', '--name', 'resume-app',
      ], { cwd: project.path });
      expect(onboard.exitCode).toBe(0);

      await writeFile(path.join(project.path, 'work.ts'), 'export const unfinished = true;\n');
      const saved = await runCli([
        '--json',
        'save',
        '--summary',
        'Parser is in; resume tests remain.',
        '--next-steps',
        'Run the remaining verification.',
      ], { cwd: project.path });
      expect(saved.exitCode).toBe(0);
      const savedData = JSON.parse(saved.stdout) as { packet: { id: string } };

      const resumed = await runCli(['resume'], { cwd: project.path });
      expect(resumed.exitCode).toBe(0);
      expect(resumed.stdout).toContain('Parser is in; resume tests remain.');
      expect(resumed.stdout).toContain('Run the remaining verification.');
      expect(resumed.stdout).toContain('work.ts');
      expect(resumed.stdout.toLowerCase()).not.toContain('confirm');

      const hook = await runCli(['hook', 'claude-code'], {
        cwd: project.path,
        input: JSON.stringify({
          session_id: 'e2e-resume-reader',
          cwd: project.path,
          hook_event_name: 'SessionStart',
          source: 'startup',
          transcript_path: '/not-readable.jsonl',
        }),
      });
      expect(hook.exitCode).toBe(0);
      const hookOutput = JSON.parse(hook.stdout) as {
        hookSpecificOutput?: { additionalContext?: string };
      };
      expect(hookOutput.hookSpecificOutput?.additionalContext).toContain('Parser is in; resume tests remain.');
      expect(hookOutput.hookSpecificOutput?.additionalContext).toContain(savedData.packet.id);
      expect(hookOutput.hookSpecificOutput?.additionalContext).not.toContain('Do not call get_packet');
      expect(hook.stdout).not.toContain('/not-readable.jsonl');

      const harness = await createMcpHarness(createNotchMcpServer({ cwd: project.path }));
      try {
        const mcpResume = await harness.callTool('resume_working_state', {}) as {
          structuredContent: { checkpoint: { packet: { id: string }; markdown: string } };
        };
        expect(mcpResume.structuredContent.checkpoint.packet.id).toBe(savedData.packet.id);
        expect(mcpResume.structuredContent.checkpoint.markdown).toContain('Parser is in; resume tests remain.');
      } finally {
        await harness.close();
      }

      const doctor = await runCli(['doctor'], { cwd: project.path });
      expect(doctor.exitCode).toBe(0);
    });
  });
});
