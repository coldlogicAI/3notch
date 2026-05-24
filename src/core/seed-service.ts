import { readFile } from 'node:fs/promises';

import { loadConfig, type LoadedConfig } from './config-service.js';
import { createPacket, type CreatePacketInput } from './packet-service.js';
import { importPacketFile } from './transfer-service.js';
import { NotchException } from '../types/errors.js';

export type SeedFromInput = {
  include?: string[];
  review?: boolean;
  sourcePath: string;
};

export async function createSeedPacket(
  context: LoadedConfig,
  input: Omit<CreatePacketInput, 'purpose' | 'sensitivity'>,
) {
  return await createPacket(context, {
    ...input,
    purpose: 'seed',
    sensitivity: 'private',
  });
}

export async function importSeedPacket(context: LoadedConfig, packetPath: string, options: { asReviewed?: boolean } = {}) {
  return await importPacketFile(context, packetPath, { ...options, forcePrivate: true, seedOnly: true });
}

export async function seedFrom(context: LoadedConfig, input: SeedFromInput) {
  if (!input.review) {
    throw new NotchException({
      code: 'NOTCH_SEED_REVIEW_REQUIRED',
      message: 'Private context seeding requires explicit review in V1.',
      recovery: 'Re-run with --review after inspecting the generated seed context.',
      severity: 'error',
      exitCode: 1,
    });
  }

  const source = await loadConfig({ cwd: input.sourcePath });
  const sourceBrief = await readFile(source.paths.brief, 'utf8').catch(() => '');
  const summary = `Reviewed private seed from ${source.config.project.name}.`;
  const result = await createSeedPacket(context, {
    importNotes: 'Imported through notch seed from after explicit review.',
    sourceLinks: [{ kind: 'repo', repoRoot: source.config.project.root, repoName: source.config.project.name }],
    summary,
    title: `Private seed from ${source.config.project.name}`,
  });

  if (sourceBrief.trim()) {
    void sourceBrief;
  }

  return await importSeedPacket(context, result.outboxPath, { asReviewed: true });
}
