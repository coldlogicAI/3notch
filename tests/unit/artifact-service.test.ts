import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { readAuditLog } from '../../src/core/audit-service.js';
import { parseArtifactFileSpec, sha256 } from '../../src/core/artifact-service.js';
import { loadConfig } from '../../src/core/config-service.js';
import { createPacket } from '../../src/core/packet-service.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('artifact service integration', () => {
  it('parses artifact file purpose labels, aliases common labels, and rejects unknown labels', () => {
    expect(parseArtifactFileSpec('src/app/icon.svg:asset')).toEqual({
      path: 'src/app/icon.svg',
      purpose: 'asset',
    });
    expect(parseArtifactFileSpec('src/app/icon.svg:favicon')).toEqual({
      path: 'src/app/icon.svg',
      purpose: 'asset',
    });
    expect(parseArtifactFileSpec('src/app/index.ts:code')).toEqual({
      path: 'src/app/index.ts',
      purpose: 'source',
    });
    expect(parseArtifactFileSpec('docs/api.md:ref')).toEqual({
      path: 'docs/api.md',
      purpose: 'reference',
    });
    expect(parseArtifactFileSpec('dist/report.html:result')).toEqual({
      path: 'dist/report.html',
      purpose: 'output',
    });
    expect(parseArtifactFileSpec('src/app/icon.svg')).toEqual({ path: 'src/app/icon.svg' });
    expect(parseArtifactFileSpec('C:\\project\\icon.svg')).toEqual({ path: 'C:\\project\\icon.svg' });
    expect(() => parseArtifactFileSpec('src/app/icon.svg:handoff')).toThrowError(
      expect.objectContaining({
        notchError: expect.objectContaining({ code: 'NOTCH_ARTIFACT_PURPOSE_INVALID' }),
      }),
    );
  });

  it('copies artifact bytes, records hashes, writes manifest, and audits binary scan skips', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'artifact-app' });
      await mkdir(path.join(project.path, 'assets'), { recursive: true });
      const markdownPath = path.join(project.path, 'assets/context.md');
      const imagePath = path.join(project.path, 'assets/mascot.jpg');
      await writeFile(markdownPath, 'Selected implementation notes.\n', 'utf8');
      await writeFile(imagePath, Buffer.from([0xff, 0xd8, 0xff, 0x00]));
      const context = await loadConfig({ cwd: project.path });

      const created = await createPacket(context, {
        files: [
          { path: 'assets/context.md', purpose: 'source' },
          { path: 'assets/mascot.jpg', purpose: 'asset' },
        ],
        nextSteps: 'Use the attached notes and image.',
        summary: 'Artifact bundle.',
        title: 'Artifact bundle',
        toAgent: 'codex',
      });
      const packetRoot = path.dirname(created.outboxPath);
      const manifest = JSON.parse(await readFile(path.join(packetRoot, 'manifest.json'), 'utf8')) as {
        artifacts: Array<{ bytes: number; path: string; sha256: string }>;
      };

      expect(created.packet.artifacts).toEqual([
        expect.objectContaining({ path: 'artifacts/context.md', purpose: 'source' }),
        expect.objectContaining({ path: 'artifacts/mascot.jpg', purpose: 'asset' }),
      ]);
      expect(await readFile(path.join(packetRoot, 'artifacts/context.md'), 'utf8')).toBe('Selected implementation notes.\n');
      expect(manifest.artifacts).toEqual(created.packet.artifacts?.map(({ path: artifactPath, sha256: hash, bytes }) => ({
        path: artifactPath,
        sha256: hash,
        bytes,
      })));
      expect(manifest.artifacts.find((artifact) => artifact.path === 'artifacts/context.md')?.sha256).toBe(
        sha256(await readFile(markdownPath)),
      );
      expect(await readAuditLog(context.paths.logs)).toEqual(expect.arrayContaining([
        expect.objectContaining({ operation: 'scan-skip', path: 'artifacts/mascot.jpg' }),
      ]));
    });
  });

  it('blocks poisoned text artifacts before writing the packet', async () => {
    await withTempProject({}, async (project) => {
      await createBareStore(project.path, { name: 'scanner-app' });
      await writeFile(path.join(project.path, 'poisoned.html'), '<script>const token = "ghp_aaaabbbbccccddddeeeeffff1234567890aaaa";</script>\n', 'utf8');
      const context = await loadConfig({ cwd: project.path });

      await expect(createPacket(context, {
        files: [{ path: 'poisoned.html', purpose: 'source' }],
        summary: 'Poisoned artifact.',
        title: 'Poisoned artifact',
        toAgent: 'codex',
      })).rejects.toMatchObject({ notchError: { code: 'NOTCH_SECRET_DETECTED' } });
      expect(await readAuditLog(context.paths.logs)).toEqual(expect.arrayContaining([
        expect.objectContaining({ operation: 'secret-blocked', recordType: 'packet' }),
      ]));
    });
  });

  it('enforces configured artifact and packet size caps with soft warnings', async () => {
    await withTempProject({}, async (project) => {
      const storePath = await createBareStore(project.path, { name: 'size-app' });
      const configPath = path.join(storePath, 'config.json');
      const config = JSON.parse(await readFile(configPath, 'utf8')) as Record<string, unknown>;
      await writeFile(configPath, `${JSON.stringify({
        ...config,
        artifacts: { maxArtifactBytes: 10, maxPacketBytes: 15 },
      }, null, 2)}\n`, 'utf8');
      await writeFile(path.join(project.path, 'warn.bin'), Buffer.alloc(8));
      await writeFile(path.join(project.path, 'reject.bin'), Buffer.alloc(10));
      await writeFile(path.join(project.path, 'other.bin'), Buffer.alloc(8));
      const context = await loadConfig({ cwd: project.path });

      const warned = await createPacket(context, {
        files: [{ path: 'warn.bin' }],
        summary: 'Warns but writes.',
        title: 'Warn bundle',
        toAgent: 'codex',
      });
      expect(warned.warnings).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'NOTCH_ARTIFACT_SIZE_WARN' }),
      ]));
      await expect(createPacket(context, {
        files: [{ path: 'reject.bin' }],
        summary: 'Rejects.',
        title: 'Reject bundle',
        toAgent: 'codex',
      })).rejects.toMatchObject({ notchError: { code: 'NOTCH_ARTIFACT_TOO_LARGE' } });
      await expect(createPacket(context, {
        files: [{ path: 'warn.bin' }, { path: 'other.bin' }],
        summary: 'Packet too large.',
        title: 'Packet too large',
        toAgent: 'codex',
      })).rejects.toMatchObject({ notchError: { code: 'NOTCH_PACKET_TOO_LARGE' } });
    });
  });
});
