import { mkdir, readFile, readdir, truncate, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

const mb = 1024 * 1024;

describe('e2e V3 packet bundle smokes', () => {
  it('runs the brand-handoff bundle workflow', async () => {
    await withTempProject({ prefix: 'notch-v3-brand-source-' }, async (source) => {
      await withTempProject({ prefix: 'notch-v3-brand-dest-' }, async (destination) => {
        await onboardPair(source.path, destination.path);
        await writeFile(path.join(source.path, 'mascot.jpg'), Buffer.from([0xff, 0xd8, 0xff, 0x01]));
        await writeFile(path.join(source.path, 'showcase.html'), '<section>Launch page</section>\n', 'utf8');

        const create = await runCli([
          '--json',
          'packet',
          'create',
          '--to-agent',
          'codex',
          '--to-repo',
          destination.path,
          '--file',
          'mascot.jpg:asset',
          '--file',
          'showcase.html:source',
          '--next-steps',
          'Build a one-page site at apps/brand-site/ using showcase.html as the layout and mascot.jpg in the hero.',
          '--summary',
          'Brand handoff for the launch page.',
          '--title',
          'Brand handoff',
        ], { cwd: source.path });
        const created = JSON.parse(create.stdout) as PacketCreateResult;
        const packetRoot = path.dirname(created.outboxPath);
        const manifest = JSON.parse(await readFile(path.join(packetRoot, 'manifest.json'), 'utf8')) as {
          artifacts: Array<{ path: string; sha256: string }>;
        };

        expect(await readdir(path.join(packetRoot, 'artifacts'))).toEqual(['mascot.jpg', 'showcase.html']);
        expect(manifest.artifacts.map((artifact) => artifact.path)).toEqual(['artifacts/mascot.jpg', 'artifacts/showcase.html']);
        expect(created.packet.nextSteps).toContain('Build a one-page site');

        const imported = await runCli(['--json', 'packet', 'import', created.outboxPath], { cwd: destination.path });
        const importedData = JSON.parse(imported.stdout) as { inboxPath: string };
        const show = await runCli(['packet', 'show', created.packet.id, '--inbox'], { cwd: destination.path });
        const preview = await runCli(['packet', 'preview', created.packet.id, '--inbox'], { cwd: destination.path });

        expect(imported.exitCode).toBe(0);
        expect(await readFile(path.join(path.dirname(importedData.inboxPath), 'artifacts/showcase.html'), 'utf8')).toBe('<section>Launch page</section>\n');
        expect(show.stdout).toContain('Build a one-page site at apps/brand-site/');
        expect(preview.stdout).toContain('artifacts/mascot.jpg');
        expect(preview.stdout).toContain('artifacts/showcase.html');
      });
    });
  }, 20_000);

  it('packs and unpacks an artifact packet with hash verification', async () => {
    await withTempProject({ prefix: 'notch-v3-pack-source-' }, async (source) => {
      await withTempProject({ prefix: 'notch-v3-pack-dest-' }, async (destination) => {
        await onboardPair(source.path, destination.path);
        await writeFile(path.join(source.path, 'asset.txt'), 'Portable bytes.\n', 'utf8');
        const created = await createBundle(source.path, destination.path, 'Round trip packet', 'asset.txt:source');
        const archivePath = path.join(source.path, 'roundtrip.notchpkt');
        const pack = await runCli(['packet', 'pack', created.packet.id, '--output', archivePath], { cwd: source.path });
        const unpack = await runCli(['--json', 'packet', 'unpack', archivePath], { cwd: destination.path });
        const unpacked = JSON.parse(unpack.stdout) as { inboxPath: string; packet: { id: string } };
        const importedRoot = path.dirname(unpacked.inboxPath);
        const sourceRoot = path.dirname(created.outboxPath);

        expect(pack.exitCode).toBe(0);
        expect(unpack.exitCode).toBe(0);
        expect(await readFile(path.join(importedRoot, 'artifacts/asset.txt'), 'utf8')).toBe(await readFile(path.join(sourceRoot, 'artifacts/asset.txt'), 'utf8'));
        expect(await readFile(path.join(importedRoot, 'manifest.json'), 'utf8')).toBe(await readFile(path.join(sourceRoot, 'manifest.json'), 'utf8'));
        expect(await readFile(path.join(destination.path, '.notch/logs/audit.jsonl'), 'utf8')).toContain('"operation":"import"');
      });
    });
  }, 20_000);

  it('rejects a hash-mismatched packed artifact without partial inbox state', async () => {
    await withTempProject({ prefix: 'notch-v3-hash-source-' }, async (source) => {
      await withTempProject({ prefix: 'notch-v3-hash-dest-' }, async (destination) => {
        await onboardPair(source.path, destination.path);
        await writeFile(path.join(source.path, 'asset.txt'), 'Original bytes.\n', 'utf8');
        const created = await createBundle(source.path, destination.path, 'Tamper packet', 'asset.txt:source');
        await writeFile(path.join(path.dirname(created.outboxPath), 'artifacts/asset.txt'), 'Tampered bytes.\n', 'utf8');
        const archivePath = path.join(source.path, 'tampered.notchpkt');
        await runCli(['packet', 'pack', created.packet.id, '--output', archivePath], { cwd: source.path });

        const unpack = await runCli(['--json', 'packet', 'unpack', archivePath], { cwd: destination.path });

        expect(unpack.exitCode).toBe(6);
        expect(JSON.parse(unpack.stderr)).toMatchObject({ error: { code: 'NOTCH_ARTIFACT_HASH_MISMATCH' } });
        expect(await readdir(path.join(destination.path, '.notch/inbox'))).toEqual([]);
        expect(await readFile(path.join(destination.path, '.notch/logs/audit.jsonl'), 'utf8')).toContain('NOTCH_ARTIFACT_HASH_MISMATCH');
      });
    });
  }, 20_000);

  it('enforces V3 size-cap hard rejects and soft warnings', async () => {
    await withTempProject({ prefix: 'notch-v3-size-' }, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'size-source'], { cwd: project.path });
      await setArtifactConfig(project.path, { maxArtifactBytes: 100 * mb, maxPacketBytes: 200 * mb });
      await createSizedFile(path.join(project.path, 'warn.bin'), 85 * mb);
      await createSizedFile(path.join(project.path, 'too-large.bin'), 100 * mb);
      await createSizedFile(path.join(project.path, 'a.bin'), 80 * mb);
      await createSizedFile(path.join(project.path, 'b.bin'), 80 * mb);
      await createSizedFile(path.join(project.path, 'c.bin'), 80 * mb);

      const warn = await runCli([
        '--json',
        'packet',
        'create',
        '--title',
        'Warn size',
        '--summary',
        'Warn size.',
        '--to-agent',
        'codex',
        '--file',
        'warn.bin',
      ], { cwd: project.path, timeoutMs: 30_000 });
      const hardArtifact = await runCli([
        '--json',
        'packet',
        'create',
        '--title',
        'Hard artifact',
        '--summary',
        'Hard artifact.',
        '--to-agent',
        'codex',
        '--file',
        'too-large.bin',
      ], { cwd: project.path, timeoutMs: 30_000 });
      const hardPacket = await runCli([
        '--json',
        'packet',
        'create',
        '--title',
        'Hard packet',
        '--summary',
        'Hard packet.',
        '--to-agent',
        'codex',
        '--file',
        'a.bin',
        '--file',
        'b.bin',
        '--file',
        'c.bin',
      ], { cwd: project.path, timeoutMs: 30_000 });

      expect(JSON.parse(warn.stdout)).toMatchObject({ warnings: [expect.objectContaining({ code: 'NOTCH_ARTIFACT_SIZE_WARN' })] });
      expect(hardArtifact.exitCode).toBe(1);
      expect(JSON.parse(hardArtifact.stderr)).toMatchObject({ error: { code: 'NOTCH_ARTIFACT_TOO_LARGE' } });
      expect(hardPacket.exitCode).toBe(1);
      expect(JSON.parse(hardPacket.stderr)).toMatchObject({ error: { code: 'NOTCH_PACKET_TOO_LARGE' } });
    });
  }, 60_000);

  it('scans text artifacts and audits binary skips', async () => {
    await withTempProject({ prefix: 'notch-v3-scan-' }, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'scan-source'], { cwd: project.path });
      await writeFile(path.join(project.path, 'poisoned.html'), '<script>const value="ghp_aaaabbbbccccddddeeeeffff1234567890aaaa";</script>\n', 'utf8');
      await writeFile(path.join(project.path, 'clean.md'), 'Clean markdown.\n', 'utf8');
      await writeFile(path.join(project.path, 'mascot.jpg'), Buffer.from([0xff, 0xd8, 0xff]));

      const poisoned = await runCli([
        '--json',
        'packet',
        'create',
        '--title',
        'Poisoned',
        '--summary',
        'Poisoned.',
        '--to-agent',
        'codex',
        '--file',
        'poisoned.html:source',
      ], { cwd: project.path });
      const clean = await runCli([
        '--json',
        'packet',
        'create',
        '--title',
        'Clean',
        '--summary',
        'Clean.',
        '--to-agent',
        'codex',
        '--file',
        'clean.md:source',
      ], { cwd: project.path });
      const binary = await runCli([
        '--json',
        'packet',
        'create',
        '--title',
        'Binary',
        '--summary',
        'Binary.',
        '--to-agent',
        'codex',
        '--file',
        'mascot.jpg:asset',
      ], { cwd: project.path });

      expect(poisoned.exitCode).toBe(5);
      expect(JSON.parse(poisoned.stderr)).toMatchObject({ error: { code: 'NOTCH_SECRET_DETECTED' } });
      expect(clean.exitCode).toBe(0);
      expect(binary.exitCode).toBe(0);
      expect(await readFile(path.join(project.path, '.notch/logs/audit.jsonl'), 'utf8')).toContain('"operation":"scan-skip"');
    });
  }, 20_000);

  it('preserves pointer-only refs without copying artifacts', async () => {
    await withTempProject({ prefix: 'notch-v3-ref-' }, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'ref-source'], { cwd: project.path });
      await mkdir(path.join(project.path, 'shared'), { recursive: true });
      await writeFile(path.join(project.path, 'shared/asset.md'), 'Shared workspace asset.\n', 'utf8');

      const create = await runCli([
        '--json',
        'packet',
        'create',
        '--title',
        'Ref packet',
        '--summary',
        'Ref packet.',
        '--to-agent',
        'codex',
        '--to-repo',
        '../sibling-store',
        '--ref',
        'shared/asset.md',
      ], { cwd: project.path });
      const created = JSON.parse(create.stdout) as PacketCreateResult;

      expect(created.packet.includedSourceLinks).toEqual([expect.objectContaining({ kind: 'file', path: 'shared/asset.md' })]);
      expect(created.packet.artifacts ?? []).toEqual([]);
      expect(created.outboxPath.endsWith('.md')).toBe(true);
    });
  }, 20_000);
});

type PacketCreateResult = {
  outboxPath: string;
  packet: {
    artifacts?: Array<{ path: string }>;
    id: string;
    includedSourceLinks?: Array<{ kind: string; path: string }>;
    nextSteps?: string;
  };
};

async function onboardPair(sourcePath: string, destinationPath: string): Promise<void> {
  await runCli(['onboard', '--yes', '--name', 'source-app'], { cwd: sourcePath });
  await runCli(['onboard', '--yes', '--name', 'destination-app'], { cwd: destinationPath });
}

async function createBundle(sourcePath: string, destinationPath: string, title: string, fileSpec: string): Promise<PacketCreateResult> {
  const create = await runCli([
    '--json',
    'packet',
    'create',
    '--title',
    title,
    '--summary',
    `${title} summary.`,
    '--to-agent',
    'codex',
    '--to-repo',
    destinationPath,
    '--file',
    fileSpec,
  ], { cwd: sourcePath });

  return JSON.parse(create.stdout) as PacketCreateResult;
}

async function setArtifactConfig(projectPath: string, artifacts: { maxArtifactBytes: number; maxPacketBytes: number }): Promise<void> {
  const configPath = path.join(projectPath, '.notch/config.json');
  const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>;
  await writeFile(configPath, `${JSON.stringify({ ...config, artifacts }, null, 2)}\n`, 'utf8');
}

async function createSizedFile(filePath: string, size: number): Promise<void> {
  await writeFile(filePath, '');
  await truncate(filePath, size);
}
