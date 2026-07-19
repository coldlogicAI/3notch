import { execFile } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

import { resolveContinuationStream, runClaudeCodeHook } from '../../src/core/continuation-service.js';
import { checkStore } from '../../src/core/check-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import { listPackets } from '../../src/core/packet-service.js';
import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

const execFileAsync = promisify(execFile);

describe('continuation service', () => {
  it('aggregates structured tasks without creating one packet per task', async () => {
    await withContinuationProject(async (projectPath) => {
      const events = Array.from({ length: 8 }, (_, index) => runClaudeCodeHook({
        session_id: 'session-aggregate',
        cwd: projectPath,
        hook_event_name: 'TaskCreated',
        task_id: `task-${index}`,
        task_subject: `Step ${index}`,
        task_description: `Complete step ${index}`,
        transcript_path: '/unreadable/transcript.jsonl',
      }));

      await Promise.all(events);
      await runClaudeCodeHook({
        session_id: 'session-aggregate',
        cwd: projectPath,
        hook_event_name: 'TaskCompleted',
        task_id: 'task-0',
        task_subject: 'Step 0',
        transcript_path: '/unreadable/transcript.jsonl',
      });

      expect(await readdir(path.join(projectPath, '.notch/outbox'))).toEqual([]);
      const state = JSON.parse(await readFile(
        path.join(projectPath, '.notch/index/continuation/session-aggregate--main.json'),
        'utf8',
      )) as { tasks: Record<string, { description?: string; status: string }> };
      expect(Object.keys(state.tasks)).toHaveLength(8);
      expect(state.tasks['task-0']?.status).toBe('completed');
      expect(state.tasks['task-0']?.description).toBe('Complete step 0');
    });
  });

  it('creates one post-compact packet from summary, tasks, and Git state without opening transcript_path', async () => {
    await withContinuationProject(async (projectPath) => {
      await writeFile(path.join(projectPath, 'src-change.ts'), 'export const changed = true;\n');
      await runClaudeCodeHook(taskEvent(projectPath, 'TaskCreated', 'task-build', 'Build continuation'));
      await runClaudeCodeHook(taskEvent(projectPath, 'TaskCompleted', 'task-build', 'Build continuation'));

      const output = await runClaudeCodeHook({
        session_id: 'session-main',
        cwd: projectPath,
        hook_event_name: 'PostCompact',
        trigger: 'auto',
        compact_summary: 'The feature is implemented and verification remains.',
        transcript_path: projectPath, // readFile(projectPath) would fail with EISDIR
      });

      expect(output.systemMessage).toContain('wrote unreviewed continuation');
      const context = await loadConfig({ cwd: projectPath });
      const packets = await listPackets(context, { direction: 'outbox' });
      expect(packets).toHaveLength(1);
      expect(packets[0]?.packet.tags).toEqual(expect.arrayContaining([
        'continuation',
        'stream-main',
        'source-post-compact',
        'fallback',
      ]));
      expect(packets[0]?.packet.origin.branch).toBe('main');
      expect(packets[0]?.packet.origin.commit).toMatch(/^[a-f0-9]{12}$/);
      expect(packets[0]?.packet.summary).toContain('The feature is implemented');
      expect(packets[0]?.packet.summary).toContain('src-change.ts');
      expect(packets[0]?.packet.summary).not.toContain('transcript.jsonl');
    });
  });

  it('writes a rate-limit fallback only when recoverable task or Git state exists', async () => {
    await withContinuationProject(async (projectPath) => {
      const empty = await runClaudeCodeHook({
        session_id: 'rate-empty',
        cwd: projectPath,
        hook_event_name: 'StopFailure',
        error: 'rate_limit',
        last_assistant_message: 'API Error: Rate limit reached',
        transcript_path: '/does/not/exist',
      });
      expect(empty).toEqual({});

      await runClaudeCodeHook(taskEvent(projectPath, 'TaskCreated', 'task-pending', 'Finish verification', 'rate-state'));
      const recovery = await runClaudeCodeHook({
        session_id: 'rate-state',
        cwd: projectPath,
        hook_event_name: 'StopFailure',
        error: 'rate_limit',
        last_assistant_message: 'API Error: Rate limit reached',
        transcript_path: '/does/not/exist',
      });
      expect(recovery.systemMessage).toContain('wrote unreviewed continuation');

      const context = await loadConfig({ cwd: projectPath });
      const packets = await listPackets(context, { direction: 'outbox' });
      expect(packets).toHaveLength(1);
      expect(packets[0]?.packet.tags).toContain('source-rate-limit');
      expect(packets[0]?.packet.summary).toContain('Finish verification');
    });
  });

  it('offers a matching checkpoint once without loading its content', async () => {
    await withContinuationProject(async (projectPath) => {
      await runClaudeCodeHook({
        session_id: 'writer',
        cwd: projectPath,
        hook_event_name: 'PostCompact',
        trigger: 'manual',
        compact_summary: 'Sensitive-to-this-test continuation details.',
      });

      const first = await runClaudeCodeHook({
        session_id: 'reader',
        cwd: projectPath,
        hook_event_name: 'SessionStart',
        source: 'startup',
      });
      const second = await runClaudeCodeHook({
        session_id: 'reader',
        cwd: projectPath,
        hook_event_name: 'SessionStart',
        source: 'resume',
      });
      const compact = await runClaudeCodeHook({
        session_id: 'reader',
        cwd: projectPath,
        hook_event_name: 'SessionStart',
        source: 'compact',
      });

      expect(first.hookSpecificOutput?.additionalContext).toContain('Offer it to the user once');
      expect(JSON.stringify(first)).not.toContain('Sensitive-to-this-test');
      expect(second).toEqual({});
      expect(compact).toEqual({});
    });
  });

  it('skips a secret-bearing compact summary without failing the hook process', async () => {
    await withContinuationProject(async (projectPath) => {
      const output = await runClaudeCodeHook({
        session_id: 'secret-session',
        cwd: projectPath,
        hook_event_name: 'PostCompact',
        trigger: 'auto',
        compact_summary: 'Use api_key = forbidden-value in the next step.',
      });

      expect(output.systemMessage).toContain('hook skipped');
      expect(await readdir(path.join(projectPath, '.notch/outbox'))).toEqual([]);
    });
  });

  it('writes private fallbacks to private outbox', async () => {
    await withContinuationProject(async (projectPath) => {
      const configPath = path.join(projectPath, '.notch/config.json');
      const config = JSON.parse(await readFile(configPath, 'utf8')) as {
        continuation: { sensitivity: string };
      };
      config.continuation.sensitivity = 'private';
      await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

      await runClaudeCodeHook({
        session_id: 'private-session',
        cwd: projectPath,
        hook_event_name: 'PostCompact',
        trigger: 'auto',
        compact_summary: 'Private continuation summary.',
      });

      expect(await readdir(path.join(projectPath, '.notch/outbox'))).toEqual([]);
      expect(await readdir(path.join(projectPath, '.notch/private/outbox'))).toHaveLength(1);
    });
  });

  it('injects prompt-mode semantic checkpoint policy without loading packet content', async () => {
    await withContinuationProject(async (projectPath) => {
      const configPath = path.join(projectPath, '.notch/config.json');
      const config = JSON.parse(await readFile(configPath, 'utf8')) as {
        continuation: { mode: string };
      };
      config.continuation.mode = 'prompt';
      await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

      const output = await runClaudeCodeHook({
        session_id: 'prompt-policy',
        cwd: projectPath,
        hook_event_name: 'SessionStart',
        source: 'compact',
      });

      expect(output.hookSpecificOutput?.additionalContext).toContain('prompt mode');
      expect(output.hookSpecificOutput?.additionalContext).toContain('ask the user');
      expect(output.hookSpecificOutput?.additionalContext).toContain('source-agent');
      expect(output.systemMessage).toBeUndefined();
    });
  });

  it('deduplicates optional Stop checkpoints and chains changed successors', async () => {
    await withContinuationProject(async (projectPath) => {
      const configPath = path.join(projectPath, '.notch/config.json');
      const config = JSON.parse(await readFile(configPath, 'utf8')) as {
        continuation: { claudeCode: { events: string[] } };
      };
      config.continuation.claudeCode.events.push('Stop');
      await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

      const firstInput = {
        session_id: 'stop-session',
        cwd: projectPath,
        hook_event_name: 'Stop' as const,
        last_assistant_message: 'Implemented the first slice and tests pass.',
      };
      await runClaudeCodeHook(firstInput);
      await runClaudeCodeHook(firstInput);
      await runClaudeCodeHook({
        ...firstInput,
        last_assistant_message: 'Implemented the second slice and tests pass.',
      });

      const context = await loadConfig({ cwd: projectPath });
      const packets = await listPackets(context, { direction: 'outbox' });
      expect(packets).toHaveLength(2);
      expect(packets[0]?.packet.supersedes).toBe(packets[1]?.packet.id);
      expect(packets[0]?.packet.tags).toContain('source-stop');
    });
  });

  it('resolves explicit, branch, detached, and non-Git streams', () => {
    expect(resolveContinuationStream('release work', { branch: 'main', changedFiles: [], dirty: false })).toBe('release-work');
    expect(resolveContinuationStream(undefined, { branch: 'feature/auth', changedFiles: [], dirty: false })).toBe('feature-auth');
    expect(resolveContinuationStream(undefined, { commit: 'abcdef123456', changedFiles: [], dirty: false })).toBe('detached-abcdef12');
    expect(resolveContinuationStream(undefined, { changedFiles: [], dirty: false })).toBe('default');

    const sharedPrefix = `feature/${'a'.repeat(64)}`;
    const longOne = resolveContinuationStream(undefined, { branch: `${sharedPrefix}-one`, changedFiles: [], dirty: false });
    const longTwo = resolveContinuationStream(undefined, { branch: `${sharedPrefix}-two`, changedFiles: [], dirty: false });
    expect(longOne).not.toBe(longTwo);
    expect(longOne.length).toBeLessThanOrEqual(57);
    expect(longTwo.length).toBeLessThanOrEqual(57);
  });

  it('keeps task accumulators isolated when one session changes streams', async () => {
    await withContinuationProject(async (projectPath) => {
      const sharedPrefix = `feature/${'a'.repeat(64)}`;
      await execFileAsync('git', ['checkout', '-b', `${sharedPrefix}-one`], { cwd: projectPath });
      await runClaudeCodeHook(taskEvent(projectPath, 'TaskCreated', 'first-task', 'Only on first branch', 'stream-session'));
      await execFileAsync('git', ['checkout', '-b', `${sharedPrefix}-two`], { cwd: projectPath });
      await runClaudeCodeHook(taskEvent(projectPath, 'TaskCreated', 'second-task', 'Only on second branch', 'stream-session'));
      await runClaudeCodeHook({
        session_id: 'stream-session',
        cwd: projectPath,
        hook_event_name: 'PostCompact',
        trigger: 'manual',
        compact_summary: 'Feature stream checkpoint.',
      });

      const context = await loadConfig({ cwd: projectPath });
      const packets = await listPackets(context, { direction: 'outbox' });
      expect(packets).toHaveLength(1);
      const streamTags = packets[0]?.packet.tags.filter((tag) => tag.startsWith('stream-')) ?? [];
      expect(streamTags).toHaveLength(1);
      expect(streamTags[0]?.length).toBeLessThanOrEqual(64);
      expect(packets[0]?.packet.summary).toContain('Only on second branch');
      expect(packets[0]?.packet.summary).not.toContain('Only on first branch');

      const stateFiles = await readdir(path.join(projectPath, '.notch/index/continuation'));
      expect(stateFiles.filter((file) => file.startsWith('stream-session--'))).toHaveLength(2);
    });
  });

  it('serializes concurrent checkpoint writes into a valid linear stream chain', async () => {
    await withContinuationProject(async (projectPath) => {
      const configPath = path.join(projectPath, '.notch/config.json');
      const config = JSON.parse(await readFile(configPath, 'utf8')) as {
        project: { name: string };
      };
      config.project.name = `project-${'long-name-'.repeat(12)}`;
      await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);

      await Promise.all(Array.from({ length: 4 }, (_, index) => runClaudeCodeHook({
        session_id: `concurrent-${index}`,
        cwd: projectPath,
        hook_event_name: 'PostCompact',
        trigger: 'auto',
        compact_summary: `Concurrent checkpoint ${index}.`,
      })));

      const context = await loadConfig({ cwd: projectPath });
      const packets = await listPackets(context, { direction: 'outbox' });
      expect(packets).toHaveLength(4);
      expect(new Set(packets.map((entry) => entry.packet.id))).toHaveLength(4);
      expect(packets.filter((entry) => entry.packet.supersedes === undefined)).toHaveLength(1);

      const check = await checkStore(context);
      expect(check.summary.errors).toBe(0);
      expect(check.findings).toEqual([]);
    });
  });
});

function taskEvent(
  projectPath: string,
  hookEvent: 'TaskCreated' | 'TaskCompleted',
  taskId: string,
  taskSubject: string,
  sessionId = 'session-main',
) {
  return {
    session_id: sessionId,
    cwd: projectPath,
    hook_event_name: hookEvent,
    task_id: taskId,
    task_subject: taskSubject,
    task_description: `${taskSubject} with acceptance checks`,
    transcript_path: '/unreadable/transcript.jsonl',
  };
}

async function withContinuationProject(callback: (projectPath: string) => Promise<void>): Promise<void> {
  await withTempProject({ git: true, prefix: 'notch-continuation-' }, async (project) => {
    await execFileAsync('git', ['checkout', '-b', 'main'], { cwd: project.path });
    const onboard = await runCli([
      'onboard',
      '--yes',
      '--mcp',
      'claude-code',
      '--checkpoints',
      'script',
      '--name',
      'continuation-app',
    ], { cwd: project.path });
    expect(onboard.exitCode).toBe(0);
    await execFileAsync('git', ['add', '.'], { cwd: project.path });
    await execFileAsync('git', ['commit', '-m', 'test baseline'], { cwd: project.path });
    await callback(project.path);
  });
}
