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

export const DEFAULT_ARTIFACT_TEXT_EXTENSIONS = [
  '.md',
  '.txt',
  '.html',
  '.htm',
  '.css',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.py',
  '.rb',
  '.sh',
  '.bash',
  '.zsh',
  '.env.example',
  '.gitignore',
  '.conf',
  '.xml',
  '.svg',
] as const;

export type SecretFinding = {
  code: 'NOTCH_SECRET_DETECTED';
  excerpt?: string;
  field?: string;
  line?: number;
  message: string;
  pattern: string;
  path?: string;
};

export type SecretScanSource = {
  field?: string;
  path?: string;
};

const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;
const sshPrivateKeyPattern = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const knownTokenPatterns = [
  /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}\b/,
  /\bnpm_[A-Za-z0-9]{30,}\b/,
  /\bsk_(live|test)_[A-Za-z0-9]{16,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
  /\bglpat-[A-Za-z0-9_-]{20,}\b/,
];
const tokenLikePattern = /\b(?=[A-Za-z0-9_=-]{32,}\b)(?=[A-Za-z0-9_=-]*[A-Za-z])(?=[A-Za-z0-9_=-]*\d)[A-Za-z0-9_=-]{32,}\b/g;

export function scanForSecrets(content: string, config?: NotchConfig, source: SecretScanSource = {}): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const rules = config?.privacy.redactPatterns ?? [
    { kind: 'regex' as const, value: '(api[_-]?key|secret|password|token)', flags: 'i' },
  ];

  if (config?.privacy.secretScan ?? true) {
    for (const rule of rules) {
      const regex = new RegExp(rule.value, rule.flags ?? 'i');
      const match = regex.exec(content);

      if (match) {
        findings.push(secretFinding({
          content,
          index: match.index,
          length: match[0].length,
          message: `Content matched configured secret pattern: ${rule.value}`,
          pattern: rule.value,
          source,
        }));
      }
    }
  }

  if (config?.privacy.highEntropySecretScan ?? true) {
    const knownTokenRanges: Array<{ end: number; start: number }> = [];
    const jwtMatch = jwtPattern.exec(content);

    if (jwtMatch) {
      findings.push(secretFinding({
        content,
        index: jwtMatch.index,
        length: jwtMatch[0].length,
        message: 'Content contains a JWT-like token.',
        pattern: 'jwt',
        source,
      }));
    }

    const privateKeyMatch = sshPrivateKeyPattern.exec(content);

    if (privateKeyMatch) {
      findings.push(secretFinding({
        content,
        index: privateKeyMatch.index,
        length: privateKeyMatch[0].length,
        message: 'Content contains an SSH/private-key marker.',
        pattern: 'private-key',
        source,
      }));
    }

    for (const pattern of knownTokenPatterns) {
      const match = pattern.exec(content);

      if (match) {
        knownTokenRanges.push({ start: match.index, end: match.index + match[0].length });
        findings.push(secretFinding({
          content,
          index: match.index,
          length: match[0].length,
          message: 'Content contains a known access-token format.',
          pattern: 'known-token',
          source,
        }));
        break;
      }
    }

    for (const match of content.matchAll(tokenLikePattern)) {
      const value = match[0];
      const index = match.index ?? 0;

      if (isGeneratedNotchToken(value)) {
        continue;
      }

      if (knownTokenRanges.some((range) => rangesOverlap(index, index + value.length, range.start, range.end))) {
        continue;
      }

      if (uniqueCharRatio(value) > 0.35) {
        findings.push(secretFinding({
          content,
          index,
          length: value.length,
          message: 'Content contains a token-like high-entropy string.',
          pattern: 'token-like',
          source,
        }));
        break;
      }
    }
  }

  return findings;
}

export function assertNoSecrets(content: string, config?: NotchConfig, source: SecretScanSource = {}): void {
  const findings = scanForSecrets(content, config, source);

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
    field?: string;
    logsDir: string;
    path?: string;
    recordId?: string;
    recordType: RecordType;
    sourceTool: SourceTool;
  },
): Promise<void> {
  const findings = scanForSecrets(content, config, {
    ...(audit.field ? { field: audit.field } : {}),
    ...(audit.path ? { path: audit.path } : {}),
  });

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

export async function assertNoSecretsInArtifactWithAudit(
  content: Buffer,
  config: NotchConfig,
  audit: {
    actor: Actor;
    actorNameResolution: ActorNameResolution;
    actorTypeResolution: ActorTypeResolution;
    logsDir: string;
    path: string;
    recordId: string;
    sourcePath: string;
    recordType: RecordType;
    sourceTool: SourceTool;
  },
): Promise<void> {
  if (!isTextLikeArtifactPath(audit.sourcePath, config)) {
    await appendAuditEntry(audit.logsDir, {
      schemaVersion: '1.0.0',
      at: new Date().toISOString(),
      operation: 'scan-skip',
      result: 'success',
      actor: audit.actor,
      actorNameResolution: audit.actorNameResolution,
      actorTypeResolution: audit.actorTypeResolution,
      sourceTool: audit.sourceTool,
      recordType: audit.recordType,
      recordId: audit.recordId,
      path: audit.path,
      reason: 'extension-not-in-allowlist',
    });
    return;
  }

  await assertNoSecretsWithAudit(content.toString('utf8'), config, {
    actor: audit.actor,
    actorNameResolution: audit.actorNameResolution,
    actorTypeResolution: audit.actorTypeResolution,
    field: `packet artifact ${audit.path}`,
    logsDir: audit.logsDir,
    path: audit.path,
    recordId: audit.recordId,
    recordType: audit.recordType,
    sourceTool: audit.sourceTool,
  });
}

export function isTextLikeArtifactPath(filePath: string, config?: NotchConfig): boolean {
  const normalized = filePath.toLowerCase();
  const configured = config?.artifacts?.scanTextExtensions ?? [];
  const allowlist = [...DEFAULT_ARTIFACT_TEXT_EXTENSIONS, ...configured]
    .map((extension) => extension.toLowerCase())
    .map((extension) => extension.startsWith('.') ? extension : `.${extension}`);

  return allowlist.some((extension) => normalized.endsWith(extension));
}

export function findingToError(finding: SecretFinding | undefined): NotchError {
  const location = finding ? findingLocation(finding) : undefined;
  return {
    code: 'NOTCH_SECRET_DETECTED',
    message: [finding?.message ?? 'Content appears to contain a secret.', location].filter(Boolean).join(' '),
    recovery: 'Remove sensitive values from the 3Notch record and store them in a dedicated manager. If this is benign documentation prose, rephrase trigger words like API key, password, token, or secret before writing.',
    severity: 'error',
    exitCode: 5,
  };
}

function secretFinding(input: {
  content: string;
  index: number;
  length: number;
  message: string;
  pattern: string;
  source: SecretScanSource;
}): SecretFinding {
  const location = lineExcerpt(input.content, input.index, input.length);

  return {
    code: 'NOTCH_SECRET_DETECTED',
    ...(location.excerpt ? { excerpt: location.excerpt } : {}),
    ...(input.source.field ? { field: input.source.field } : {}),
    ...(location.line ? { line: location.line } : {}),
    message: input.message,
    pattern: input.pattern,
    ...(input.source.path ? { path: input.source.path } : {}),
  };
}

function findingLocation(finding: SecretFinding): string | undefined {
  const parts = [
    finding.path ? `File: ${finding.path}.` : undefined,
    finding.field ? `Field: ${finding.field}.` : undefined,
    finding.line ? `Line: ${finding.line}.` : undefined,
    finding.excerpt ? `Excerpt: ${finding.excerpt}` : undefined,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' ') : undefined;
}

function lineExcerpt(content: string, index: number, length: number): { excerpt?: string; line?: number } {
  const start = content.lastIndexOf('\n', Math.max(0, index - 1)) + 1;
  const nextNewline = content.indexOf('\n', index);
  const end = nextNewline === -1 ? content.length : nextNewline;
  const line = content.slice(start, end).trim();
  const redactedLine = redactMatchedRange(line, Math.max(0, index - start), length);
  const lineNumber = content.slice(0, index).split('\n').length;

  return {
    excerpt: truncate(redactedLine),
    line: lineNumber,
  };
}

function redactMatchedRange(line: string, start: number, length: number): string {
  return `${line.slice(0, start)}[matched pattern]${line.slice(start + length)}`;
}

function truncate(value: string): string {
  return value.length > 160 ? `${value.slice(0, 157)}...` : value;
}

function rangesOverlap(start: number, end: number, otherStart: number, otherEnd: number): boolean {
  return start < otherEnd && otherStart < end;
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
