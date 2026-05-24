import { readFile, writeFile } from 'node:fs/promises';
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

  it('previews the agent-visible packet content and warns on current scanner findings', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'preview-app'], { cwd: project.path });
      const create = await runCli([
        '--json',
        'packet',
        'create',
        '--title',
        'Preview me',
        '--summary',
        'Use this selected implementation summary.',
        '--to-agent',
        'claude-desktop',
      ], { cwd: project.path });
      const created = JSON.parse(create.stdout) as { outboxPath: string; packet: { id: string } };

      const preview = await runCli(['packet', 'preview', created.packet.id, '--outbox'], { cwd: project.path });

      expect(preview.exitCode).toBe(0);
      expect(preview.stdout).toContain('This is what an agent reading this packet will see.');
      expect(preview.stdout).toContain('Use this selected implementation summary.');

      const original = await readFile(created.outboxPath, 'utf8');
      await writeFile(created.outboxPath, `${original}\napi_key=abc123\n`, 'utf8');

      const warned = await runCli(['packet', 'preview', created.packet.id, '--outbox'], { cwd: project.path });

      expect(warned.exitCode).toBe(0);
      expect(warned.stdout).toContain('scanner warning');
    });
  });

  it('imports packet markdown from stdin', async () => {
    await withTempProject({ prefix: 'notch-source-' }, async (source) => {
      await withTempProject({ prefix: 'notch-dest-' }, async (destination) => {
        await runCli(['onboard', '--yes', '--name', 'stdin-source'], { cwd: source.path });
        await runCli(['onboard', '--yes', '--name', 'stdin-destination'], { cwd: destination.path });
        const create = await runCli([
          '--json',
          'packet',
          'create',
          '--title',
          'Clipboard packet',
          '--summary',
          'Context copied out of a web chat.',
          '--to-agent',
          'codex',
        ], { cwd: source.path });
        const created = JSON.parse(create.stdout) as { outboxPath: string; packet: { id: string } };
        const markdown = await readFile(created.outboxPath, 'utf8');
        const imported = await runCli(['--json', 'packet', 'import', '-'], {
          cwd: destination.path,
          input: markdown,
        });
        const importedData = JSON.parse(imported.stdout) as { inboxPath: string; packet: { id: string; importedFrom: string } };

        expect(imported.exitCode).toBe(0);
        expect(importedData.inboxPath).toContain(path.join('.notch', 'inbox'));
        expect(importedData.packet.id).toBe(created.packet.id);
        expect(importedData.packet.importedFrom).toBe('stdin');
      });
    });
  });

  it('runs the secret scanner against stdin imports', async () => {
    await withTempProject({ prefix: 'notch-source-' }, async (source) => {
      await withTempProject({ prefix: 'notch-dest-' }, async (destination) => {
        await runCli(['onboard', '--yes', '--name', 'scanner-source'], { cwd: source.path });
        await runCli(['onboard', '--yes', '--name', 'scanner-destination'], { cwd: destination.path });
        const create = await runCli([
          '--json',
          'packet',
          'create',
          '--title',
          'Scanner packet',
          '--summary',
          'Context copied out of a web chat.',
          '--to-agent',
          'codex',
        ], { cwd: source.path });
        const created = JSON.parse(create.stdout) as { outboxPath: string };
        const markdown = `${await readFile(created.outboxPath, 'utf8')}\napi_key=abc123\n`;
        const imported = await runCli(['--json', 'packet', 'import', '-'], {
          cwd: destination.path,
          input: markdown,
        });

        expect(imported.exitCode).toBe(5);
        expect(JSON.parse(imported.stderr)).toMatchObject({
          error: { code: 'NOTCH_SECRET_DETECTED' },
        });
      });
    });
  });
});
