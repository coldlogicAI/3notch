import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('e2e durable inbox request and reply', () => {
  it('moves a request and typed reply between isolated stores with verified lineage, checks, traces, and no lock remnants', async () => {
    await withTempProject({ prefix: 'notch-inbox-sender-' }, async (sender) => {
      await withTempProject({ prefix: 'notch-inbox-receiver-' }, async (receiver) => {
        await runCli(['onboard', '--yes', '--name', 'sender'], { cwd: sender.path });
        await runCli(['onboard', '--yes', '--name', 'receiver'], { cwd: receiver.path });
        const mailboxRoot = path.join(sender.path, 'durable-mailbox');
        await runCli(['inbox', 'init', '--name', 'sender', '--root', mailboxRoot], { cwd: sender.path });
        await runCli(['inbox', 'init', '--name', 'receiver', '--root', mailboxRoot], { cwd: receiver.path });

        const request = await createPacket(sender.path, {
          summary: 'Review the isolated handoff and reply with a confirmation.',
          title: 'Durable request',
          toAgent: 'receiver',
          toRepo: 'receiver',
        });
        const requestArchive = await packPacket(sender.path, request.id);
        const sentRequest = await sendPacket(sender.path, requestArchive, 'local:receiver');
        const importedRequest = await pullPacket(receiver.path, sentRequest.deliveryId);

        expect(importedRequest.importedPacketId).toBe(request.id);
        expect((await runCli(['check'], { cwd: receiver.path })).exitCode).toBe(0);

        const reply = await runCli([
          '--json',
          '--agent',
          'receiver-model',
          'reply',
          request.id,
          '--type',
          'confirmation',
          '--summary',
          'The durable request was received and reviewed.',
          '--next-steps',
          'Continue from the confirmed handoff.',
        ], { cwd: receiver.path });
        expect(reply.exitCode).toBe(0);
        const replyData = JSON.parse(reply.stdout) as { packet: { id: string; replyTo: string }; path: string };
        expect(replyData.packet.replyTo).toBe(request.id);
        expect(replyData.path).toContain(path.join('.notch', 'outbox'));

        const replyArchive = await packPacket(receiver.path, replyData.packet.id);
        const sentReply = await sendPacket(receiver.path, replyArchive, 'local:sender');
        const importedReply = await pullPacket(sender.path, sentReply.deliveryId);
        const shownReply = await runCli([
          '--json', 'packet', 'show', replyData.packet.id, '--inbox',
        ], { cwd: sender.path });

        expect(importedReply.importedPacketId).toBe(replyData.packet.id);
        expect(JSON.parse(shownReply.stdout)).toMatchObject({
          packet: {
            id: replyData.packet.id,
            replyTo: request.id,
            replyType: 'confirmation',
          },
        });
        expect((await runCli(['check'], { cwd: sender.path })).exitCode).toBe(0);

        await expect(runCli(['inbox', 'ack', sentRequest.deliveryId], { cwd: receiver.path })).resolves.toMatchObject({ exitCode: 0 });
        await expect(runCli(['inbox', 'ack', sentReply.deliveryId], { cwd: sender.path })).resolves.toMatchObject({ exitCode: 0 });
        expect(await mailboxRemnants(mailboxRoot)).toEqual([]);

        for (const projectPath of [sender.path, receiver.path]) {
          const auditLines = (await readFile(path.join(projectPath, '.notch/logs/audit.jsonl'), 'utf8'))
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line) as { operation: string });
          expect(auditLines).toEqual(expect.arrayContaining([
            expect.objectContaining({ operation: 'inbox-init' }),
            expect.objectContaining({ operation: 'inbox-send' }),
            expect.objectContaining({ operation: 'inbox-pull' }),
            expect.objectContaining({ operation: 'inbox-ack' }),
          ]));
        }
      });
    });
  }, 30_000);
});

async function createPacket(
  cwd: string,
  input: { summary: string; title: string; toAgent: string; toRepo: string },
): Promise<{ id: string }> {
  const result = await runCli([
    '--json',
    'packet',
    'create',
    '--title',
    input.title,
    '--summary',
    input.summary,
    '--to-agent',
    input.toAgent,
    '--to-repo',
    input.toRepo,
    '--next-steps',
    'Review this handoff and reply.',
  ], { cwd });
  expect(result.exitCode).toBe(0);
  return { id: (JSON.parse(result.stdout) as { packet: { id: string } }).packet.id };
}

async function packPacket(cwd: string, packetId: string): Promise<string> {
  const archivePath = path.join(cwd, `${packetId}.notchpkt`);
  const result = await runCli([
    '--json', 'packet', 'pack', packetId, '--output', archivePath,
  ], { cwd });
  expect(result.exitCode).toBe(0);
  return archivePath;
}

async function sendPacket(cwd: string, archivePath: string, to: string): Promise<{ deliveryId: string }> {
  const result = await runCli(['--json', 'send', archivePath, '--to', to], { cwd });
  expect(result.exitCode).toBe(0);
  return JSON.parse(result.stdout) as { deliveryId: string };
}

async function pullPacket(cwd: string, deliveryId: string): Promise<{ importedPacketId: string }> {
  const result = await runCli([
    '--json', '--agent', 'receiving-model', 'inbox', 'pull', deliveryId, '--import',
  ], { cwd });
  expect(result.exitCode).toBe(0);
  return JSON.parse(result.stdout) as { importedPacketId: string };
}

async function mailboxRemnants(root: string): Promise<string[]> {
  const remnants: string[] = [];

  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);

      if (entry.name.includes('.tmp') || entry.name.includes('.lock') || entry.name.includes('abandoned-')) {
        remnants.push(path.relative(root, entryPath));
      }

      if (entry.isDirectory()) {
        await visit(entryPath);
      }
    }
  }

  await visit(root);
  return remnants.sort();
}
