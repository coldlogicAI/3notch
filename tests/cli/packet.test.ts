import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch packet', () => {
  it('creates, lists, shows, and imports packets across two repos', async () => {
    await withTempProject({ prefix: 'notch-source-' }, async (source) => {
      await withTempProject({ prefix: 'notch-dest-' }, async (destination) => {
        await runCli(['onboard', '--yes', '--name', 'source-app'], { cwd: source.path });
        await runCli(['onboard', '--yes', '--name', 'destination-app'], { cwd: destination.path });

        const create = await runCli(
          [
            '--json',
            'packet',
            'create',
            '--title',
            'Source app state',
            '--summary',
            'Source app implementation context.',
            '--to-agent',
            'codex',
            '--to-repo',
            destination.path,
            '--file',
            'src/index.ts',
          ],
          { cwd: source.path },
        );
        expect(create.exitCode).toBe(0);
        const created = JSON.parse(create.stdout) as { outboxPath: string; packet: { id: string } };
        expect(created.outboxPath).toContain('.notch/outbox');

        const sourceList = await runCli(['--json', 'packet', 'list', '--outbox'], { cwd: source.path });
        expect(JSON.parse(sourceList.stdout)).toMatchObject({
          packets: [expect.objectContaining({ packet: expect.objectContaining({ id: created.packet.id }) })],
        });

        const sourceShow = await runCli(['packet', 'show', created.packet.id, '--outbox'], {
          cwd: source.path,
        });
        expect(sourceShow.stdout).toContain('Source app implementation context.');

        const imported = await runCli(['--json', 'packet', 'import', created.outboxPath], {
          cwd: destination.path,
        });
        expect(imported.exitCode).toBe(0);
        const importedData = JSON.parse(imported.stdout) as { inboxPath: string };
        expect(importedData.inboxPath).toContain(path.join('.notch', 'inbox'));

        const destinationList = await runCli(['--json', 'packet', 'list', '--inbox'], {
          cwd: destination.path,
        });
        expect(JSON.parse(destinationList.stdout)).toMatchObject({
          packets: [expect.objectContaining({ packet: expect.objectContaining({ id: created.packet.id }) })],
        });

        const partialShow = await runCli(['--json', 'packet', 'show', 'source-app', '--inbox'], {
          cwd: destination.path,
        });
        expect(partialShow.exitCode).toBe(1);
        expect(JSON.parse(partialShow.stderr)).toMatchObject({
          error: { code: 'NOTCH_RECORD_NOT_FOUND' },
        });
      });
    });
  }, 15_000);
});
