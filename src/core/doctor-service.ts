import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { readAuditLog } from './audit-service.js';
import { assertNoSymlinksInside } from './path-safety.js';
import { scanForSecrets } from './secret-scan-service.js';
import { rebuildIndex } from './index-service.js';
import { scanMarkdownRecords } from './store-service.js';
import { requiredStoreDirs } from './store-layout.js';
import type { LoadedConfig } from './config-service.js';
import type { NotchError } from '../types/errors.js';

export type DoctorCheck = {
  code: string;
  message: string;
  path?: string;
  severity: 'ok' | 'warn' | 'error';
};

export async function runDoctor(
  context: LoadedConfig,
  options: { fix?: boolean; strict?: boolean } = {},
): Promise<{ checks: DoctorCheck[]; errors: NotchError[]; healthy: boolean }> {
  const checks: DoctorCheck[] = [];
  const errors: NotchError[] = [];

  for (const dir of requiredStoreDirs) {
    const dirPath = path.join(context.storePath, dir);
    try {
      if (options.fix) {
        await mkdir(dirPath, { recursive: true });
      } else {
        const dirStat = await stat(dirPath);
        if (!dirStat.isDirectory()) {
          throw new Error(`${dirPath} is not a directory`);
        }
      }
      checks.push({ code: 'NOTCH_DIR_PRESENT', message: `${dir} exists`, path: dirPath, severity: 'ok' });
    } catch {
      checks.push({ code: 'NOTCH_DIR_MISSING', message: `${dir} is missing`, path: dirPath, severity: 'error' });
      errors.push({
        code: 'NOTCH_DIR_MISSING',
        message: `${dir} is missing.`,
        path: dirPath,
        recovery: 'Run notch doctor --fix.',
        severity: 'error',
        exitCode: 1,
      });
    }
  }

  try {
    await assertNoSymlinksInside(context.storePath);
    checks.push({ code: 'NOTCH_NO_SYMLINKS', message: 'No symlinks inside .notch', severity: 'ok' });
  } catch (error) {
    checks.push({ code: 'NOTCH_SYMLINK_REJECTED', message: 'Symlink found inside .notch', severity: 'error' });
    errors.push({
      code: 'NOTCH_SYMLINK_REJECTED',
      message: error instanceof Error ? error.message : 'Symlink found inside .notch.',
      severity: 'error',
      exitCode: 5,
    });
  }

  const gitignorePath = path.join(context.storePath, '.gitignore');
  const gitignore = await readFile(gitignorePath, 'utf8').catch(() => '');

  for (const required of ['index/', 'logs/', 'private/']) {
    if (!gitignore.includes(required)) {
      checks.push({ code: 'NOTCH_PRIVATE_IGNORE_MISSING', message: `.notch/.gitignore missing ${required}`, path: gitignorePath, severity: 'warn' });
      errors.push({
        code: 'NOTCH_PRIVATE_IGNORE_MISSING',
        message: `.notch/.gitignore must include ${required}.`,
        path: gitignorePath,
        recovery: 'Run notch doctor --fix or edit .notch/.gitignore.',
        severity: options.strict ? 'error' : 'warn',
        ...(options.strict ? { exitCode: 6 } : {}),
      });
    }
  }

  if (options.fix && !gitignore.includes('index/')) {
    await writeFile(gitignorePath, 'index/\nlogs/\nprivate/\n', 'utf8');
  }

  const records = await scanMarkdownRecords(context.storePath, { includeInvalid: true, includePrivate: true });
  const invalidRecords = records.filter((record) => !record.ok);

  for (const invalid of invalidRecords) {
    checks.push({ code: 'NOTCH_RECORD_INVALID', message: 'Invalid or corrupt record', path: invalid.path, severity: 'error' });
    errors.push({
      code: 'NOTCH_RECORD_INVALID',
      message: 'Invalid or corrupt record.',
      path: invalid.path,
      recovery: 'Fix or remove the invalid record.',
      severity: 'error',
      exitCode: 3,
    });
  }

  for (const record of records) {
    if (record.ok) {
      const findings = scanForSecrets(JSON.stringify(record.record.metadata), context.config);
      if (findings.length > 0) {
        checks.push({ code: 'NOTCH_SECRET_DETECTED', message: findings[0]?.message ?? 'Secret detected', path: record.path, severity: 'error' });
        errors.push({
          code: 'NOTCH_SECRET_DETECTED',
          message: findings[0]?.message ?? 'Secret detected.',
          path: record.path,
          recovery: 'Remove suspected secrets from .notch records.',
          severity: 'error',
          exitCode: 5,
        });
      }
    }
  }

  const auditEntries = await readAuditLog(context.paths.logs);
  const corruptAudit = auditEntries.filter((entry) => 'error' in entry);

  for (const entry of corruptAudit) {
    checks.push({ code: 'NOTCH_AUDIT_CORRUPT', message: entry.error.message, path: context.paths.logs, severity: 'error' });
    errors.push({
      code: 'NOTCH_AUDIT_CORRUPT',
      message: entry.error.message,
      path: context.paths.logs,
      recovery: 'Fix malformed JSONL lines in the audit log.',
      severity: 'error',
      exitCode: 3,
    });
  }

  if (options.fix) {
    await rebuildIndex(context.storePath);
    checks.push({ code: 'NOTCH_INDEX_REBUILT', message: 'Derived index rebuilt', severity: 'ok' });
  }

  return {
    checks,
    errors,
    healthy: errors.every((error) => error.severity !== 'error'),
  };
}
