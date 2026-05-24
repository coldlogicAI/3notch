import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

export type RunCliOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  timeoutMs?: number;
  useBuiltCli?: boolean;
};

export type RunCliResult = {
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  stderr: string;
  stdout: string;
};

const repoRoot = path.resolve(import.meta.dirname, '../..');

function cliCommand(useBuiltCli: boolean): { command: string; args: string[] } {
  if (useBuiltCli) {
    const builtCli = path.join(repoRoot, 'dist/cli/index.js');

    if (!existsSync(builtCli)) {
      throw new Error(`Built CLI not found at ${builtCli}. Run npm run build first.`);
    }

    return { command: process.execPath, args: [builtCli] };
  }

  return {
    command: process.execPath,
    args: [
      '--import',
      path.join(repoRoot, 'node_modules/tsx/dist/loader.mjs'),
      path.join(repoRoot, 'src/cli/index.ts'),
    ],
  };
}

export async function runCli(
  args: string[],
  options: RunCliOptions = {},
): Promise<RunCliResult> {
  const command = cliCommand(options.useBuiltCli ?? false);
  const child = spawn(command.command, [...command.args, ...args], {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  const timeoutMs = options.timeoutMs ?? 10_000;

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  if (options.input !== undefined) {
    child.stdin.end(options.input);
  } else {
    child.stdin.end();
  }

  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`CLI timed out after ${timeoutMs}ms: notch ${args.join(' ')}`));
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (exitCode, signal) => {
      clearTimeout(timeout);
      resolve({ exitCode, signal, stderr, stdout });
    });
  });
}
