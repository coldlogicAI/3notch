import type { NotchError } from '../types/errors.js';

export type CommandResult<T> = {
  data: T;
  warnings: NotchError[];
};

export function formatWarnings(warnings: NotchError[]): string {
  return warnings.map((warning) => `warning ${warning.code}: ${warning.message}`).join('\n');
}
