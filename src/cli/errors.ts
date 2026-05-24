import { printError } from './output.js';
import { errorToNotchError, type NotchError } from '../types/errors.js';

export function handleCliError(error: unknown, options: { json?: boolean } = {}): void {
  const notchError = normalizeCliError(error);
  printError(notchError, options.json === undefined ? {} : { json: options.json });
  process.exitCode = notchError.exitCode ?? 10;
}

export function normalizeCliError(error: unknown): NotchError {
  return errorToNotchError(error);
}
