import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export type StoreFixtureOptions = {
  name?: string;
  root?: string;
};

export async function createBareStore(
  projectRoot: string,
  options: StoreFixtureOptions = {},
): Promise<string> {
  const storePath = path.join(projectRoot, '.notch');
  const projectName = options.name ?? path.basename(projectRoot);
  const root = options.root ?? projectRoot;

  await mkdir(path.join(storePath, 'briefs'), { recursive: true });
  await mkdir(path.join(storePath, 'inbox'), { recursive: true });
  await mkdir(path.join(storePath, 'outbox'), { recursive: true });
  await mkdir(path.join(storePath, 'private/inbox'), { recursive: true });
  await mkdir(path.join(storePath, 'private/outbox'), { recursive: true });
  await mkdir(path.join(storePath, 'index'), { recursive: true });
  await mkdir(path.join(storePath, 'logs'), { recursive: true });

  await writeFile(path.join(storePath, '.gitignore'), 'index/\nlogs/\nprivate/\n', 'utf8');
  await writeFile(
    path.join(storePath, 'config.json'),
    `${JSON.stringify(
      {
        schemaVersion: '1.0.0',
        project: { name: projectName, root },
        store: {
          path: '.notch',
          recordFormat: 'markdown-yaml',
          index: { enabled: true, engine: 'file-scan' },
        },
        privacy: {
          telemetry: false,
          redactPatterns: [{ kind: 'regex', value: '(api[_-]?key|secret|password|token)', flags: 'i' }],
          secretScan: true,
          highEntropySecretScan: true,
        },
        defaults: {
          allowedMcpWriteTools: [
            'create_brief',
            'create_packet',
            'import_packet',
            'create_seed_packet',
            'import_seed_packet',
          ],
        },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return storePath;
}
