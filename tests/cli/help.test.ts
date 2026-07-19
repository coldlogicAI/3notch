import { describe, expect, it } from 'vitest';

import { createProgram } from '../../src/cli/program.js';
import { readJsonRepoFile } from '../helpers/package-inspection.js';

type CommanderExit = {
  exitCode: number;
};

type PackageJson = {
  version: string;
};

function isCommanderExit(error: unknown): error is CommanderExit {
  return (
    typeof error === 'object' &&
    error !== null &&
    'exitCode' in error &&
    typeof error.exitCode === 'number'
  );
}

async function runCli(args: string[]): Promise<{
  exitCode: number;
  stderr: string;
  stdout: string;
}> {
  let stderr = '';
  let stdout = '';
  let exitCode = 0;
  const program = createProgram();

  program.exitOverride();
  program.configureOutput({
    outputError: (message, write) => write(message),
    writeErr: (message) => {
      stderr += message;
    },
    writeOut: (message) => {
      stdout += message;
    },
  });

  try {
    await program.parseAsync(['node', 'notch', ...args], { from: 'node' });
  } catch (error) {
    if (!isCommanderExit(error)) {
      throw error;
    }

    exitCode = error.exitCode;
  }

  return { exitCode, stderr, stdout };
}

describe('CLI skeleton', () => {
  it('prints help for the bootstrap CLI', async () => {
    const result = await runCli(['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('Usage: notch [options]');
    expect(result.stdout).toContain('--cwd <path>');
    expect(result.stdout).toContain('--store <path>');
    expect(result.stdout).toContain('seed');
    expect(result.stdout).toContain('create, import, pack, preview, and manage context');
    expect(result.stdout).toContain('mcp serve');
  });

  it('prints the current version', async () => {
    const packageJson = await readJsonRepoFile<PackageJson>('package.json');
    const result = await runCli(['--version']);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.trim()).toBe(packageJson.version);
  });
});
