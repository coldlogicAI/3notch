import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { readAuditLog } from './audit-service.js';
import { checkStore } from './check-service.js';
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

type SeenRecordId = {
  packetDirection?: 'inbox' | 'outbox';
  path: string;
  recordType?: string;
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
  let gitignore = await readFile(gitignorePath, 'utf8').catch(() => '');
  const requiredGitignoreEntries = ['index/', 'logs/', 'private/'];
  const missingGitignoreEntries = requiredGitignoreEntries.filter((required) => !gitignore.includes(required));

  if (options.fix && missingGitignoreEntries.length > 0) {
    const existing = gitignore.trimEnd();
    const next = [existing, ...missingGitignoreEntries].filter(Boolean).join('\n');
    gitignore = `${next}\n`;
    await writeFile(gitignorePath, gitignore, 'utf8');
  }

  for (const required of requiredGitignoreEntries) {
    if (gitignore.includes(required)) {
      checks.push({ code: 'NOTCH_PRIVATE_IGNORE_PRESENT', message: `.notch/.gitignore includes ${required}`, path: gitignorePath, severity: 'ok' });
    } else {
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

  const records = await scanMarkdownRecords(context.storePath, { includeInvalid: true, includePrivate: true });
  const invalidRecords = records.filter((record) => !record.ok);
  const seenIds = new Map<string, SeenRecordId[]>();

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
      const recordId = typeof record.record.metadata.id === 'string' ? record.record.metadata.id : undefined;

      if (recordId) {
        const packetDirection = packetDirectionFor(record.relativePath);
        const recordType = typeof record.record.metadata.recordType === 'string' ? record.record.metadata.recordType : undefined;
        const current: SeenRecordId = {
          path: record.path,
          ...(packetDirection ? { packetDirection } : {}),
          ...(recordType ? { recordType } : {}),
        };
        const previous = seenIds.get(recordId) ?? [];
        const firstDisallowed = previous.find((seen) => !isAllowedPacketTransferPair(seen, current));

        if (firstDisallowed) {
          checks.push({ code: 'NOTCH_RECORD_ID_DUPLICATE', message: `Duplicate record ID ${recordId}`, path: record.path, severity: 'error' });
          errors.push({
            code: 'NOTCH_RECORD_ID_DUPLICATE',
            message: `Duplicate record ID ${recordId}.`,
            path: record.path,
            recovery: `Change one duplicate ID. First occurrence: ${firstDisallowed.path}.`,
            severity: 'error',
            exitCode: 3,
          });
        }

        seenIds.set(recordId, [...previous, current]);
      }

      const findings = scanForSecrets(`${JSON.stringify(record.record.metadata)}\n${record.record.body}`, context.config);
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

  const check = await checkStore(context);
  checks.push({
    code: 'NOTCH_CHECK_SUMMARY',
    message: `3notch check: ${check.summary.errors} errors, ${check.summary.warnings} warnings - run "notch check" for details`,
    severity: check.summary.errors > 0 || check.summary.warnings > 0 ? 'warn' : 'ok',
  });

  return {
    checks,
    errors,
    healthy: errors.every((error) => error.severity !== 'error'),
  };
}

function packetDirectionFor(relativePath: string): 'inbox' | 'outbox' | undefined {
  if (relativePath.includes('/outbox/') || relativePath.startsWith('outbox/') || relativePath.startsWith('private/outbox/')) {
    return 'outbox';
  }

  if (relativePath.includes('/inbox/') || relativePath.startsWith('inbox/') || relativePath.startsWith('private/inbox/')) {
    return 'inbox';
  }

  return undefined;
}

function isAllowedPacketTransferPair(
  first: SeenRecordId,
  current: SeenRecordId,
): boolean {
  return (
    first.recordType === 'packet' &&
    current.recordType === 'packet' &&
    first.packetDirection !== undefined &&
    current.packetDirection !== undefined &&
    first.packetDirection !== current.packetDirection
  );
}
