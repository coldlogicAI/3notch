import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/run-cli.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('notch audit integration', () => {
  it('writes audit JSONL for successful packet writes', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'audit-app'], { cwd: project.path });

      const created = await runCli([
        '--json',
        'packet',
        'create',
        '--title',
        'Audited packet',
        '--summary',
        'Packet creation should be audited.',
        '--to-agent',
        'codex',
      ], { cwd: project.path });

      expect(created.exitCode).toBe(0);
      const auditLines = (await readFile(path.join(project.path, '.notch/logs/audit.jsonl'), 'utf8'))
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as { operation: string; recordType?: string; result: string });
      expect(auditLines).toEqual(
        expect.arrayContaining([expect.objectContaining({ operation: 'create', recordType: 'packet', result: 'success' })]),
      );
    });
  });

  it('reports corrupt audit JSONL during doctor', async () => {
    await withTempProject({}, async (project) => {
      await runCli(['onboard', '--yes', '--name', 'audit-corrupt'], { cwd: project.path });
      await appendFile(path.join(project.path, '.notch/logs/audit.jsonl'), '{bad json\n', 'utf8');

      const result = await runCli(['--json', 'doctor'], { cwd: project.path });

      expect(result.exitCode).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({
        checks: expect.arrayContaining([expect.objectContaining({ code: 'NOTCH_AUDIT_CORRUPT' })]),
      });
    });
  });

  it('attributes packet imports to the local importing actor', async () => {
    await withTempProject({ prefix: 'notch-audit-source-' }, async (source) => {
      await withTempProject({ prefix: 'notch-audit-dest-' }, async (destination) => {
        await runCli(['onboard', '--yes', '--name', 'audit-source'], { cwd: source.path });
        await runCli(['onboard', '--yes', '--name', 'audit-destination'], { cwd: destination.path });
        const created = await runCli([
          '--json',
          '--actor',
          'Source Author',
          'packet',
          'create',
          '--title',
          'Import audit packet',
          '--summary',
          'Packet for import attribution.',
          '--to-agent',
          'codex',
        ], { cwd: source.path });
        const { outboxPath } = JSON.parse(created.stdout) as { outboxPath: string };

        const imported = await runCli(['--actor', 'Local Importer', 'packet', 'import', outboxPath], {
          cwd: destination.path,
        });
        expect(imported.exitCode).toBe(0);

        const auditLines = (await readFile(path.join(destination.path, '.notch/logs/audit.jsonl'), 'utf8'))
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line) as { actor: { name: string }; actorNameResolution: string; operation: string });
        expect(auditLines).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              actor: expect.objectContaining({ name: 'Local Importer' }),
              actorNameResolution: 'cli-flag',
              operation: 'import',
            }),
          ]),
        );
        expect(auditLines.find((line) => line.operation === 'import')?.actor.name).not.toBe('Source Author');
      });
    });
  });
});
