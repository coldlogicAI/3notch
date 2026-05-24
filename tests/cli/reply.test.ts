import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch reply', () => {
  it('writes a typed reply packet and updates relationships', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'reply-app'], { cwd: project.path });
      const created = await runCli([
        '--json',
        'packet',
        'create',
        '--title',
        'Parent packet',
        '--summary',
        'Parent packet summary.',
        '--to-agent',
        'codex',
      ], { cwd: project.path });
      const parent = JSON.parse(created.stdout) as { packet: { id: string } };
      const reply = await runCli([
        '--json',
        'reply',
        parent.packet.id,
        '--type',
        'question',
        '--summary',
        'Can you clarify the migration order?',
      ], { cwd: project.path });
      const replyData = JSON.parse(reply.stdout) as { packet: { id: string; replyTo: string; replyType: string; status: string }; path: string };
      const relationships = JSON.parse(await readFile(`${project.path}/.notch/index/relationships.json`, 'utf8')) as {
        edges: Array<{ type: string; from: string; to: string }>;
      };

      expect(reply.exitCode).toBe(0);
      expect(replyData.path).toContain('.notch/outbox');
      expect(replyData.packet).toMatchObject({
        replyTo: parent.packet.id,
        replyType: 'question',
        status: 'open',
      });
      expect(relationships.edges).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'replyTo', from: replyData.packet.id, to: parent.packet.id }),
      ]));
    });
  });
});
