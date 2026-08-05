import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch durable inbox CLI', () => {
  it('moves a packed packet through init, send, list, pull/import, check, and ack with useful output', async () => {
    await withTempProject({}, async (sender) => {
      await withTempProject({}, async (receiver) => {
        await onboard(sender.path, 'sender');
        await onboard(receiver.path, 'receiver');
        const mailboxRoot = path.join(sender.path, 'mailbox');
        const senderInit = await runCli([
          '--json', 'inbox', 'init', '--name', 'Sender Agent', '--root', mailboxRoot,
        ], { cwd: sender.path });
        const receiverInit = await runCli([
          'inbox', 'init', '--name', 'Receiver Agent', '--root', mailboxRoot,
        ], { cwd: receiver.path });

        expect(senderInit.exitCode).toBe(0);
        expect(JSON.parse(senderInit.stdout)).toMatchObject({
          ok: true,
          address: 'local:sender-agent',
          root: mailboxRoot,
          alreadyInitialized: false,
        });
        expect(receiverInit.exitCode).toBe(0);
        expect(receiverInit.stdout).toContain('Durable inbox ready at local:receiver-agent');
        expect(receiverInit.stdout).toContain(`Mailbox: ${mailboxRoot}`);

        const packed = await createPackedPacket(sender.path, receiver.path, 'CLI handoff');
        const send = await runCli([
          '--json', 'send', packed.archivePath, '--to', 'local:receiver-agent',
        ], { cwd: sender.path });
        const sent = JSON.parse(send.stdout) as {
          deliveryId: string;
          packetHash: string;
          packetId: string;
        };

        expect(send.exitCode).toBe(0);
        expect(sent).toMatchObject({
          packetId: packed.packetId,
          packetHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        });

        const humanList = await runCli(['inbox', 'list'], { cwd: receiver.path });
        const list = await runCli(['--json', 'inbox', 'list'], { cwd: receiver.path });
        expect(humanList.stdout).toContain(`${sent.deliveryId}\tpending\tlocal:sender-agent`);
        expect(JSON.parse(list.stdout)).toMatchObject({
          address: 'local:receiver-agent',
          deliveries: [expect.objectContaining({ deliveryId: sent.deliveryId, state: 'pending' })],
        });

        const pull = await runCli([
          '--json', '--agent', 'receiver-model', 'inbox', 'pull', sent.deliveryId, '--import',
        ], { cwd: receiver.path });
        expect(pull.exitCode).toBe(0);
        expect(JSON.parse(pull.stdout)).toMatchObject({
          deliveryId: sent.deliveryId,
          importedPacketId: packed.packetId,
          state: 'pulled',
        });
        expect((await runCli(['check'], { cwd: receiver.path })).exitCode).toBe(0);

        const ack = await runCli(['inbox', 'ack', sent.deliveryId], { cwd: receiver.path });
        expect(ack.exitCode).toBe(0);
        expect(ack.stdout).toContain(`Acknowledged delivery ${sent.deliveryId}`);
        expect(ack.stdout).toContain('Packet bytes retained for audit.');
        expect((await runCli(['--json', 'inbox', 'list'], { cwd: receiver.path })).stdout).toContain('"deliveries": []');
        expect(JSON.parse((await runCli(['--json', 'inbox', 'list', '--all'], { cwd: receiver.path })).stdout)).toMatchObject({
          deliveries: [expect.objectContaining({ state: 'acked', importedPacketId: packed.packetId })],
        });
        expect(await readFile(path.join(receiver.path, '.notch/inbox-config.json'), 'utf8')).toContain('local:receiver-agent');
      });
    });
  }, 40_000);

  it('makes identical CLI send retries explicit and idempotent', async () => {
    await withTempProject({}, async (sender) => {
      await withTempProject({}, async (receiver) => {
        await onboard(sender.path, 'sender');
        await onboard(receiver.path, 'receiver');
        const mailboxRoot = path.join(sender.path, 'mailbox');
        await runCli(['inbox', 'init', '--name', 'sender', '--root', mailboxRoot], { cwd: sender.path });
        await runCli(['inbox', 'init', '--name', 'receiver', '--root', mailboxRoot], { cwd: receiver.path });
        const packed = await createPackedPacket(sender.path, receiver.path, 'Retry handoff');
        const first = await runCli(['send', packed.archivePath, '--to', 'local:receiver'], { cwd: sender.path });
        const retry = await runCli(['send', packed.archivePath, '--to', 'local:receiver'], { cwd: sender.path });

        expect(first.exitCode).toBe(0);
        expect(first.stdout).toContain('Sent packet');
        expect(retry.exitCode).toBe(0);
        expect(retry.stdout).toContain('Already delivered packet');
        expect(JSON.parse((await runCli(['--json', 'inbox', 'list'], { cwd: receiver.path })).stdout).deliveries).toHaveLength(1);
      });
    });
  });

  it('fails with actionable JSON when config is missing or review is requested without import', async () => {
    await withTempProject({}, async (project) => {
      await onboard(project.path, 'unconfigured');
      const list = await runCli(['--json', 'inbox', 'list'], { cwd: project.path });
      const pull = await runCli([
        '--json', 'inbox', 'pull', 'delivery_aaaaaaaaaaaaaaaaaaaaaaaa', '--as-reviewed',
      ], { cwd: project.path });

      expect(list.exitCode).toBe(2);
      expect(JSON.parse(list.stderr)).toMatchObject({
        error: {
          code: 'NOTCH_INBOX_NOT_CONFIGURED',
          recovery: expect.stringContaining('notch inbox init'),
        },
      });
      expect(pull.exitCode).toBe(1);
      expect(JSON.parse(pull.stderr)).toMatchObject({ error: { code: 'NOTCH_INBOX_IMPORT_REQUIRED' } });
    });
  });

  it('documents the minimal durable-inbox command surface in help', async () => {
    const rootHelp = await runCli(['--help']);
    const inboxHelp = await runCli(['inbox', '--help']);

    expect(rootHelp.stdout).toContain('send');
    expect(rootHelp.stdout).toContain('inbox');
    expect(inboxHelp.stdout).toContain('init');
    expect(inboxHelp.stdout).toContain('list');
    expect(inboxHelp.stdout).toContain('pull');
    expect(inboxHelp.stdout).toContain('ack');
    expect(inboxHelp.stdout).not.toContain('delete');
  });
});

async function onboard(projectPath: string, name: string): Promise<void> {
  const result = await runCli(['onboard', '--yes', '--name', name], { cwd: projectPath });
  expect(result.exitCode).toBe(0);
}

async function createPackedPacket(
  senderPath: string,
  receiverPath: string,
  title: string,
): Promise<{ archivePath: string; packetId: string }> {
  const create = await runCli([
    '--json',
    'packet',
    'create',
    '--title',
    title,
    '--summary',
    `${title} summary.`,
    '--to-agent',
    'receiver-agent',
    '--to-repo',
    receiverPath,
    '--next-steps',
    'Review and continue.',
  ], { cwd: senderPath });
  expect(create.exitCode).toBe(0);
  const packetId = (JSON.parse(create.stdout) as { packet: { id: string } }).packet.id;
  const archivePath = path.join(senderPath, `${packetId}.notchpkt`);
  const pack = await runCli([
    '--json', 'packet', 'pack', packetId, '--output', archivePath,
  ], { cwd: senderPath });
  expect(pack.exitCode).toBe(0);
  return { archivePath, packetId };
}
