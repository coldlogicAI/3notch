import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch onboard', () => {
  it('creates a healthy starter .notch store with --yes', async () => {
    await withTempProject({ git: true }, async (project) => {
      const result = await runCli(['onboard', '--yes', '--name', 'starter-app'], { cwd: project.path });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('Initialized 3Notch store');

      const storePath = path.join(project.path, '.notch');
      const config = JSON.parse(await readFile(path.join(storePath, 'config.json'), 'utf8')) as {
        privacy: { telemetry: boolean };
        project: { name: string; root: string };
      };
      const gitignore = await readFile(path.join(storePath, '.gitignore'), 'utf8');
      const brief = await readFile(path.join(storePath, 'brief.md'), 'utf8');
      const readme = await readFile(path.join(storePath, 'README.md'), 'utf8');

      expect(config.project.name).toBe('starter-app');
      expect(await realpath(config.project.root)).toBe(await realpath(project.path));
      expect(config.privacy.telemetry).toBe(false);
      expect(gitignore).toContain('index/');
      expect(gitignore).toContain('logs/');
      expect(gitignore).toContain('private/');
      expect(brief).toContain('recordType: project_brief');
      expect(brief).toContain('## Current Focus');
      expect(readme).toContain('Agent Quickstart');
      expect(readme).toContain('notch packet create');
    });
  });

  it('does not overwrite existing source records without --force', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'starter-app'], { cwd: project.path });
      const briefPath = path.join(project.path, '.notch/brief.md');
      const before = await readFile(briefPath, 'utf8');
      const second = await runCli(['onboard', '--yes', '--name', 'changed-app'], { cwd: project.path });
      const after = await readFile(briefPath, 'utf8');

      expect(second.exitCode).toBe(0);
      expect(second.stdout).toContain('already initialized');
      expect(after).toBe(before);
    });
  });

  it('prints MCP setup instructions without mutating external client configs', async () => {
    await withTempProject({}, async (project) => {
      const result = await runCli(['onboard', '--yes', '--mcp', 'codex'], { cwd: project.path });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('notch mcp serve --store');
      expect(result.stdout).toContain('--include-private');
      expect(result.stdout).toContain('Agent Instructions');
      expect(result.stdout).toContain('create_packet');
    });
  });

  it('prints an agent instruction hint without --mcp', async () => {
    await withTempProject({}, async (project) => {
      const result = await runCli(['onboard', '--yes'], { cwd: project.path });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('ask your agent to read .notch/README.md');
      expect(result.stdout).toContain('notch prompt --client claude-chat');
      expect(result.stdout).not.toContain('notch prompt --client <client>');
    });
  });

  it('supports JSON output', async () => {
    await withTempProject({}, async (project) => {
      const result = await runCli(['--json', 'onboard', '--yes', '--name', 'json-app'], {
        cwd: project.path,
      });

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        created: true,
        projectName: 'json-app',
      });
    });
  });
});
