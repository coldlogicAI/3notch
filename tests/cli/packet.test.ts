import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch packet', () => {
  it('normalizes common artifact purpose aliases', async () => {
    await withTempProject({ prefix: 'notch-alias-' }, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'artifact-purpose-app'], { cwd: project.path });
      await mkdir(path.join(project.path, 'src/app'), { recursive: true });
      await writeFile(path.join(project.path, 'src/app/icon.svg'), '<svg />\n', 'utf8');

      const result = await runCli(
        [
          '--json',
          'packet',
          'create',
          '--title',
          'Favicon delivery',
          '--summary',
          'Favicon artifact purpose smoke.',
          '--to-agent',
          'codex',
          '--file',
          'src/app/icon.svg:favicon',
        ],
        { cwd: project.path },
      );

      expect(result.exitCode).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        packet: {
          artifacts: [
            expect.objectContaining({
              path: 'artifacts/src/app/icon.svg',
              purpose: 'asset',
            }),
          ],
        },
      });
    });
  });

  it('rejects unknown artifact purpose labels with a clear error', async () => {
    await withTempProject({ prefix: 'notch-invalid-purpose-' }, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'artifact-purpose-app'], { cwd: project.path });
      await mkdir(path.join(project.path, 'src/app'), { recursive: true });
      await writeFile(path.join(project.path, 'src/app/icon.svg'), '<svg />\n', 'utf8');

      const result = await runCli(
        [
          '--json',
          'packet',
          'create',
          '--title',
          'Invalid purpose',
          '--summary',
          'Invalid artifact purpose smoke.',
          '--to-agent',
          'codex',
          '--file',
          'src/app/icon.svg:handoff',
        ],
        { cwd: project.path },
      );

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stderr)).toMatchObject({
        error: {
          code: 'NOTCH_ARTIFACT_PURPOSE_INVALID',
          recovery: expect.stringContaining('asset'),
        },
      });
    });
  });

  it('prints a private packet hint after creating private packets', async () => {
    await withTempProject({ prefix: 'notch-private-hint-' }, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'private-hint-app'], { cwd: project.path });

      const result = await runCli([
        'packet',
        'create',
        '--title',
        'Private seed',
        '--summary',
        'Private context for a new repo.',
        '--private',
      ], { cwd: project.path });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Private packet: use --private with packet list, show, and preview.');
    });
  });

  it('creates, lists, shows, and imports packets across two repos', async () => {
    await withTempProject({ prefix: 'notch-source-' }, async (source) => {
      await withTempProject({ prefix: 'notch-dest-' }, async (destination) => {
        await runCli(['onboard', '--yes', '--name', 'source-app'], { cwd: source.path });
        await runCli(['onboard', '--yes', '--name', 'destination-app'], { cwd: destination.path });
        await mkdir(path.join(source.path, 'src'), { recursive: true });
        await writeFile(path.join(source.path, 'src/index.ts'), 'export const value = 1;\n', 'utf8');

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
        expect(created.outboxPath.endsWith(path.join('source-app-state-to-codex', 'packet.md'))).toBe(true);

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
        expect(importedData.inboxPath.endsWith('packet.md')).toBe(true);

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

  it('packs and unpacks packet archives', async () => {
    await withTempProject({ prefix: 'notch-source-' }, async (source) => {
      await withTempProject({ prefix: 'notch-dest-' }, async (destination) => {
        await runCli(['onboard', '--yes', '--name', 'pack-source'], { cwd: source.path });
        await runCli(['onboard', '--yes', '--name', 'pack-destination'], { cwd: destination.path });
        await writeFile(path.join(source.path, 'showcase.html'), '<main>bundle</main>\n', 'utf8');
        const create = await runCli([
          '--json',
          'packet',
          'create',
          '--title',
          'Packed packet',
          '--summary',
          'Packet with artifact bytes.',
          '--to-agent',
          'codex',
          '--to-repo',
          destination.path,
          '--file',
          'showcase.html:source',
          '--next-steps',
          'Use artifacts/showcase.html.',
        ], { cwd: source.path });
        const created = JSON.parse(create.stdout) as { packet: { id: string } };
        const archivePath = path.join(source.path, 'handoff.notchpkt');
        const pack = await runCli(['--json', 'packet', 'pack', created.packet.id, '--output', archivePath], { cwd: source.path });
        const packed = JSON.parse(pack.stdout) as { archivePath: string; bytes: number };

        expect(pack.exitCode).toBe(0);
        expect(packed.archivePath).toBe(archivePath);
        expect(packed.bytes).toBeGreaterThan(0);

        const readableArchivePath = path.join(source.path, 'handoff with spaces.notchpkt');
        const readablePack = await runCli(['packet', 'pack', created.packet.id, '--output', readableArchivePath], { cwd: source.path });

        expect(readablePack.exitCode).toBe(0);
        expect(readablePack.stdout).toContain('To receive this packet in another repo:');
        expect(readablePack.stdout).toContain('cd /path/to/destination-repo');
        expect(readablePack.stdout).toContain('notch onboard --yes');
        expect(readablePack.stdout).toContain(`notch packet unpack '${readableArchivePath}'`);

        const unpack = await runCli(['--json', 'packet', 'unpack', archivePath], { cwd: destination.path });
        const unpacked = JSON.parse(unpack.stdout) as { inboxPath: string; packet: { id: string; nextSteps: string } };

        expect(unpack.exitCode).toBe(0);
        expect(unpacked.packet.id).toBe(created.packet.id);
        expect(unpacked.packet.nextSteps).toBe('Use artifacts/showcase.html.');
        expect(await readFile(path.join(path.dirname(unpacked.inboxPath), 'artifacts/showcase.html'), 'utf8')).toBe('<main>bundle</main>\n');
      });
    });
  }, 15_000);

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
