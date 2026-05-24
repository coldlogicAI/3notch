import type { NotchError } from '../types/errors.js';

export type CliOutputOptions = {
  json?: boolean;
  quiet?: boolean;
};

export function printInfo(message: string, options: CliOutputOptions = {}): void {
  if (!options.quiet && !options.json) {
    process.stdout.write(`${message}\n`);
  }
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printError(error: NotchError, options: CliOutputOptions = {}): void {
  if (options.json) {
    process.stderr.write(`${JSON.stringify({ error }, null, 2)}\n`);
    return;
  }

  process.stderr.write(`error ${error.code}\n${error.message}\n`);

  if (error.recovery) {
    process.stderr.write(`\nFix:\n  ${error.recovery}\n`);
  }
}
