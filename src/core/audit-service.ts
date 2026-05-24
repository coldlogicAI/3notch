import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { schemaService } from './schema-service.js';
import { NotchException } from '../types/errors.js';
import type { AuditEntry } from '../types/records.js';

export async function appendAuditEntry(logsDir: string, entry: AuditEntry): Promise<void> {
  const validation = schemaService.validate<AuditEntry>('audit', entry, path.join(logsDir, 'audit.jsonl'));

  if (!validation.ok) {
    const firstError = validation.errors[0] ?? {
      code: 'NOTCH_RECORD_INVALID',
      message: 'Audit entry is invalid.',
      severity: 'error' as const,
      exitCode: 1,
    };
    throw new NotchException({
      ...firstError,
      code: 'NOTCH_RECORD_INVALID',
      exitCode: 1,
    });
  }

  try {
    await mkdir(logsDir, { recursive: true });
    await appendFile(path.join(logsDir, 'audit.jsonl'), `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (error) {
    throw new NotchException({
      code: 'NOTCH_AUDIT_WRITE_FAILED',
      message: error instanceof Error ? error.message : 'Audit log append failed.',
      path: path.join(logsDir, 'audit.jsonl'),
      recovery: 'Check permissions for .notch/logs.',
      severity: 'error',
      exitCode: 10,
    });
  }
}

export async function readAuditLog(logsDir: string): Promise<Array<AuditEntry | { error: Error; line: string }>> {
  const logPath = path.join(logsDir, 'audit.jsonl');
  let raw: string;

  try {
    raw = await readFile(logPath, 'utf8');
  } catch {
    return [];
  }

  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        const parsed = JSON.parse(line) as AuditEntry;
        const validation = schemaService.validate<AuditEntry>('audit', parsed, logPath);

        if (!validation.ok) {
          return { error: new Error(validation.errors[0]?.message ?? 'Invalid audit entry'), line };
        }

        return validation.data;
      } catch (error) {
        return { error: error instanceof Error ? error : new Error(String(error)), line };
      }
    });
}
