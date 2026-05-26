import { cp, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

const fixturePath = path.resolve(import.meta.dirname, '../../fixtures/v2-back-compat');

describe('e2e V2 back compatibility', () => {
  it('reads V2 single-file packets, briefs, marks, replies, check, and doctor without migration', async () => {
    await withTempProject({ prefix: 'notch-v2-compat-' }, async (project) => {
      await cp(fixturePath, project.path, { recursive: true });
      const before = await readFile(path.join(project.path, '.notch/outbox/20260524T120200Z-v2-source-to-codex.md'), 'utf8');

      const list = await runCli(['--json', 'packet', 'list', '--private'], { cwd: project.path });
      const show = await runCli(['packet', 'show', 'packet_v2_source', '--outbox'], { cwd: project.path });
      const check = await runCli(['--json', 'check'], { cwd: project.path });
      const doctor = await runCli(['doctor'], { cwd: project.path });
      const after = await readFile(path.join(project.path, '.notch/outbox/20260524T120200Z-v2-source-to-codex.md'), 'utf8');

      expect(list.exitCode).toBe(0);
      expect(JSON.parse(list.stdout)).toMatchObject({
        packets: expect.arrayContaining([
          expect.objectContaining({ packet: expect.objectContaining({ id: 'packet_v2_source' }) }),
          expect.objectContaining({ packet: expect.objectContaining({ id: 'packet_v2_reply', replyTo: 'packet_v2_source' }) }),
          expect.objectContaining({ packet: expect.objectContaining({ id: 'packet_v2_mark', purpose: 'seed' }) }),
        ]),
      });
      expect(show.stdout).toContain('V2 source packet summary.');
      expect(JSON.parse(check.stdout)).toMatchObject({ findings: [], summary: { errors: 0, warnings: 0 } });
      expect(doctor.exitCode).toBe(0);
      expect(after).toBe(before);
    });
  }, 20_000);
});
