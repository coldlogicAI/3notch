import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch hook claude-code', () => {
  it('processes real stdin JSON and emits valid non-blocking hook JSON', async () => {
    await withTempProject({ prefix: 'notch-hook-cli-' }, async (project) => {
      const onboard = await runCli([
        'onboard',
        '--yes',
        '--mcp',
        'claude-code',
        '--checkpoints',
        'script',
      ], { cwd: project.path });
      expect(onboard.exitCode).toBe(0);

      const event = await runCli(['hook', 'claude-code'], {
        cwd: project.path,
        input: JSON.stringify({
          session_id: 'cli-session',
          cwd: project.path,
          hook_event_name: 'TaskCreated',
          task_id: 'task-cli',
          task_subject: 'Exercise the real CLI hook',
          task_description: 'Send JSON over stdin.',
          transcript_path: '/never/read.jsonl',
        }),
      });

      expect(event.exitCode).toBe(0);
      expect(event.stderr).toBe('');
      expect(JSON.parse(event.stdout)).toEqual({});
      expect(await readdir(path.join(project.path, '.notch/outbox'))).toEqual([]);

      const state = await readFile(
        path.join(project.path, '.notch/index/continuation/cli-session--default.json'),
        'utf8',
      );
      expect(state).toContain('Exercise the real CLI hook');
      expect(state).not.toContain('transcript_path');
    });
  });

  it('returns a warning with exit zero for malformed event payloads', async () => {
    await withTempProject({ prefix: 'notch-hook-invalid-' }, async (project) => {
      await runCli(['onboard', '--yes'], { cwd: project.path });
      const result = await runCli(['hook', 'claude-code'], {
        cwd: project.path,
        input: JSON.stringify({ hook_event_name: 'TaskCreated' }),
      });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        systemMessage: expect.stringContaining('hook skipped'),
      });
    });
  });

  it('returns a warning with exit zero for invalid stdin JSON', async () => {
    await withTempProject({ prefix: 'notch-hook-invalid-json-' }, async (project) => {
      const result = await runCli(['hook', 'claude-code'], {
        cwd: project.path,
        input: '{not-json',
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(JSON.parse(result.stdout)).toMatchObject({
        systemMessage: expect.stringContaining('hook skipped'),
      });
    });
  });
});
