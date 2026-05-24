import { appendAuditEntry } from './audit-service.js';
import { NotchException, type NotchError } from '../types/errors.js';
import type {
  Actor,
  ActorNameResolution,
  ActorTypeResolution,
  NotchConfig,
  RecordType,
  SourceTool,
} from '../types/records.js';

export type SecretFinding = {
  code: 'NOTCH_SECRET_DETECTED';
  message: string;
  pattern: string;
};

const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;
const sshPrivateKeyPattern = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const tokenLikePattern = /\b(?=[A-Za-z0-9_=-]{32,}\b)(?=[A-Za-z0-9_=-]*[A-Z])(?=[A-Za-z0-9_=-]*[a-z])(?=[A-Za-z0-9_=-]*\d)[A-Za-z0-9_=-]{32,}\b/g;

export function scanForSecrets(content: string, config?: NotchConfig): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const rules = config?.privacy.redactPatterns ?? [
    { kind: 'regex' as const, value: '(api[_-]?key|secret|password|token)', flags: 'i' },
  ];

  if (config?.privacy.secretScan ?? true) {
    for (const rule of rules) {
      const regex = new RegExp(rule.value, rule.flags ?? 'i');

      if (regex.test(content)) {
        findings.push({
          code: 'NOTCH_SECRET_DETECTED',
          message: `Content matched configured secret pattern: ${rule.value}`,
          pattern: rule.value,
        });
      }
    }
  }

  if (config?.privacy.highEntropySecretScan ?? true) {
    if (jwtPattern.test(content)) {
      findings.push({ code: 'NOTCH_SECRET_DETECTED', message: 'Content contains a JWT-like token.', pattern: 'jwt' });
    }

    if (sshPrivateKeyPattern.test(content)) {
      findings.push({
        code: 'NOTCH_SECRET_DETECTED',
        message: 'Content contains an SSH/private-key marker.',
        pattern: 'private-key',
      });
    }

    for (const match of content.matchAll(tokenLikePattern)) {
      const value = match[0];

      if (isGeneratedNotchToken(value)) {
        continue;
      }

      if (uniqueCharRatio(value) > 0.35) {
        findings.push({
          code: 'NOTCH_SECRET_DETECTED',
          message: 'Content contains a token-like high-entropy string.',
          pattern: 'token-like',
        });
        break;
      }
    }
  }

  return findings;
}

export function assertNoSecrets(content: string, config?: NotchConfig): void {
  const findings = scanForSecrets(content, config);

  if (findings.length > 0) {
    throw new NotchException(findingToError(findings[0]));
  }
}

export async function assertNoSecretsWithAudit(
  content: string,
  config: NotchConfig,
  audit: {
    actor: Actor;
    actorNameResolution: ActorNameResolution;
    actorTypeResolution: ActorTypeResolution;
    logsDir: string;
    recordId?: string;
    recordType: RecordType;
    sourceTool: SourceTool;
  },
): Promise<void> {
  const findings = scanForSecrets(content, config);

  if (findings.length === 0) {
    return;
  }

  const error = findingToError(findings[0]);

  await appendAuditEntry(audit.logsDir, {
    schemaVersion: '1.0.0',
    at: new Date().toISOString(),
    operation: 'secret-blocked',
    result: 'blocked',
    actor: audit.actor,
    actorNameResolution: audit.actorNameResolution,
    actorTypeResolution: audit.actorTypeResolution,
    sourceTool: audit.sourceTool,
    recordType: audit.recordType,
    ...(audit.recordId ? { recordId: audit.recordId } : {}),
    errorCode: error.code,
  });

  throw new NotchException(error);
}

export function findingToError(finding: SecretFinding | undefined): NotchError {
  return {
    code: 'NOTCH_SECRET_DETECTED',
    message: finding?.message ?? 'Content appears to contain a secret.',
    recovery: 'Remove secrets from the 3Notch record and store them in a dedicated secret manager.',
    severity: 'error',
    exitCode: 5,
  };
}

function uniqueCharRatio(value: string): number {
  return new Set(value.split('')).size / value.length;
}

function isGeneratedNotchToken(value: string): boolean {
  return (
    /^(project_brief|brief|packet)_\d{8}T\d{6}Z_[a-z0-9_]+$/.test(value) ||
    /^\d{8}T\d{6}Z-[a-z0-9-]+$/.test(value)
  );
}
