import { readFile, writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { checkStore } from '../../src/core/check-service.js';
import { createPacket } from '../../src/core/packet-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('check service', () => {
  it('returns no findings for a clean store', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'clean-check-app' });
      const context = await loadConfig({ cwd: project.path });
      const result = await checkStore(context);

      expect(result.summary).toEqual({ errors: 0, warnings: 0 });
      expect(result.findings).toEqual([]);
    });
  });

  it('reports the five V2 structural relationship rules', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'check-app' });
      const context = await loadConfig({ cwd: project.path });
      const brokenSupersedes = await createPacket(context, {
        summary: 'Broken supersedes.',
        supersedes: 'packet_missing_supersedes',
        title: 'Broken supersedes',
        toAgent: 'codex',
      });
      const brokenReply = await createPacket(context, {
        purpose: 'seed',
        replyTo: 'packet_missing_reply',
        replyType: 'question',
        requireRecipient: false,
        sensitivity: 'private',
        summary: 'Broken reply.',
        title: 'Broken reply',
      });
      const self = await createPacket(context, {
        summary: 'Self reference.',
        title: 'Self reference',
        toAgent: 'codex',
      });
      await insertFrontmatterLine(self.outboxPath, 'summary: Self reference.', `supersedes: ${self.packet.id}`);

      const cycleA = await createPacket(context, {
        summary: 'Cycle A.',
        title: 'Cycle A',
        toAgent: 'codex',
      });
      const cycleB = await createPacket(context, {
        summary: 'Cycle B.',
        supersedes: cycleA.packet.id,
        title: 'Cycle B',
        toAgent: 'codex',
      });
      await insertFrontmatterLine(cycleA.outboxPath, 'summary: Cycle A.', `supersedes: ${cycleB.packet.id}`);

      const forkParent = await createPacket(context, {
        summary: 'Fork parent.',
        title: 'Fork parent',
        toAgent: 'codex',
      });
      await createPacket(context, {
        summary: 'Fork child one.',
        supersedes: forkParent.packet.id,
        title: 'Fork child one',
        toAgent: 'codex',
      });
      await createPacket(context, {
        summary: 'Fork child two.',
        supersedes: forkParent.packet.id,
        title: 'Fork child two',
        toAgent: 'codex',
      });

      const result = await checkStore(context);

      expect(result.findings.map((finding) => finding.rule)).toEqual(expect.arrayContaining([
        'CHECK_SUPERSEDES_BROKEN',
        'CHECK_REPLYTO_BROKEN',
        'CHECK_SUPERSEDES_CYCLE',
        'CHECK_SELF_REFERENCE',
        'CHECK_SUPERSEDES_FORK',
      ]));
      expect(result.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({ rule: 'CHECK_SUPERSEDES_BROKEN', packetId: brokenSupersedes.packet.id, severity: 'error' }),
        expect.objectContaining({ rule: 'CHECK_REPLYTO_BROKEN', packetId: brokenReply.packet.id, severity: 'error' }),
        expect.objectContaining({ rule: 'CHECK_SELF_REFERENCE', packetId: self.packet.id, severity: 'error' }),
        expect.objectContaining({ rule: 'CHECK_SUPERSEDES_FORK', packetId: forkParent.packet.id, severity: 'warn' }),
      ]));
    });
  });
});

async function insertFrontmatterLine(filePath: string, marker: string, line: string): Promise<void> {
  const markdown = await readFile(filePath, 'utf8');
  await writeFile(filePath, markdown.replace(marker, `${marker}\n${line}`), 'utf8');
}
