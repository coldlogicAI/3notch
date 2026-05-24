import { buildRelationshipsIndex } from './relationships-service.js';
import { isValidScannedRecord, scanMarkdownRecords } from './store-service.js';
import type { LoadedConfig } from './config-service.js';
import type { NotchPacket } from '../types/records.js';

export type CheckRule =
  | 'CHECK_SUPERSEDES_BROKEN'
  | 'CHECK_REPLYTO_BROKEN'
  | 'CHECK_SUPERSEDES_CYCLE'
  | 'CHECK_SELF_REFERENCE'
  | 'CHECK_SUPERSEDES_FORK';

export type CheckFinding = {
  rule: CheckRule;
  severity: 'error' | 'warn';
  packetId: string;
  message: string;
  recovery: string;
};

export type CheckResult = {
  schemaVersion: '1.0.0';
  generatedAt: string;
  summary: {
    errors: number;
    warnings: number;
  };
  findings: CheckFinding[];
};

export async function checkStore(
  context: LoadedConfig,
  options: { includePrivate?: boolean } = {},
): Promise<CheckResult> {
  const scanned = await scanMarkdownRecords(context.storePath, { includePrivate: options.includePrivate ?? true });
  const validRecords = scanned.filter(isValidScannedRecord);
  const relationships = buildRelationshipsIndex(validRecords);
  const packets = validRecords
    .filter((record) => record.record.metadata.recordType === 'packet')
    .map((record) => record.record.metadata as NotchPacket)
    .sort((left, right) => left.id.localeCompare(right.id));
  const recordIds = new Set(validRecords
    .map((record) => record.record.metadata.id)
    .filter((value): value is string => typeof value === 'string'));
  const findings = sortFindings([
    ...brokenReferenceFindings(packets, recordIds),
    ...selfReferenceFindings(packets),
    ...supersedesCycleFindings(packets),
    ...supersedesForkFindings(packets),
  ]);

  return {
    schemaVersion: '1.0.0',
    generatedAt: relationships.generatedAt,
    summary: {
      errors: findings.filter((finding) => finding.severity === 'error').length,
      warnings: findings.filter((finding) => finding.severity === 'warn').length,
    },
    findings,
  };
}

function brokenReferenceFindings(packets: NotchPacket[], recordIds: Set<string>): CheckFinding[] {
  const findings: CheckFinding[] = [];

  for (const packet of packets) {
    if (packet.supersedes && !recordIds.has(packet.supersedes)) {
      findings.push({
        rule: 'CHECK_SUPERSEDES_BROKEN',
        severity: 'error',
        packetId: packet.id,
        message: `${packet.id} supersedes missing record ${packet.supersedes}.`,
        recovery: 'Import the superseded record or author a new packet without the broken supersedes edge.',
      });
    }

    if (packet.replyTo && !recordIds.has(packet.replyTo)) {
      findings.push({
        rule: 'CHECK_REPLYTO_BROKEN',
        severity: 'error',
        packetId: packet.id,
        message: `${packet.id} replies to missing record ${packet.replyTo}.`,
        recovery: 'Import the parent record or author a new reply against an existing record.',
      });
    }
  }

  return findings;
}

function selfReferenceFindings(packets: NotchPacket[]): CheckFinding[] {
  return packets
    .filter((packet) => packet.supersedes === packet.id || packet.replyTo === packet.id)
    .map((packet) => ({
      rule: 'CHECK_SELF_REFERENCE' as const,
      severity: 'error' as const,
      packetId: packet.id,
      message: `${packet.id} points at itself.`,
      recovery: 'Author a replacement packet that points at a different record.',
    }));
}

function supersedesCycleFindings(packets: NotchPacket[]): CheckFinding[] {
  const supersedes = new Map(
    packets
      .filter((packet) => packet.supersedes && packet.supersedes !== packet.id)
      .map((packet) => [packet.id, packet.supersedes as string]),
  );
  const seenCycles = new Set<string>();
  const findings: CheckFinding[] = [];

  for (const packet of packets) {
    const path: string[] = [];
    const pathSet = new Set<string>();
    let current: string | undefined = packet.id;

    while (current && supersedes.has(current)) {
      if (pathSet.has(current)) {
        const cycle = path.slice(path.indexOf(current));
        const key = [...cycle].sort().join('|');

        if (!seenCycles.has(key)) {
          seenCycles.add(key);
          findings.push({
            rule: 'CHECK_SUPERSEDES_CYCLE',
            severity: 'error',
            packetId: [...cycle].sort()[0] ?? current,
            message: `Supersedes cycle detected: ${cycle.join(' -> ')} -> ${current}.`,
            recovery: 'Author a new packet chain that points in one direction without looping.',
          });
        }
        break;
      }

      path.push(current);
      pathSet.add(current);
      current = supersedes.get(current);
    }
  }

  return findings;
}

function supersedesForkFindings(packets: NotchPacket[]): CheckFinding[] {
  const byParent = new Map<string, string[]>();

  for (const packet of packets) {
    if (!packet.supersedes) {
      continue;
    }

    byParent.set(packet.supersedes, [...(byParent.get(packet.supersedes) ?? []), packet.id].sort());
  }

  return [...byParent.entries()]
    .filter(([, children]) => children.length >= 2)
    .map(([parent, children]) => ({
      rule: 'CHECK_SUPERSEDES_FORK' as const,
      severity: 'warn' as const,
      packetId: parent,
      message: `${children.length} packets supersede ${parent}: ${children.join(', ')}.`,
      recovery: 'Review the competing packets and author a single follow-up if one should win.',
    }));
}

function sortFindings(findings: CheckFinding[]): CheckFinding[] {
  const severityRank = { error: 0, warn: 1 };

  return [...findings].sort((left, right) => {
    const fields = [
      severityRank[left.severity] - severityRank[right.severity],
      left.packetId.localeCompare(right.packetId),
      left.rule.localeCompare(right.rule),
    ];

    return fields.find((value) => value !== 0) ?? 0;
  });
}
