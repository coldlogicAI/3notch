import { listTargetedBriefs } from './brief-service.js';
import { listPackets } from './packet-service.js';
import type { LoadedConfig } from './config-service.js';
import type { ProjectStatusSummary } from '../types/records.js';

export async function getStatus(context: LoadedConfig): Promise<ProjectStatusSummary> {
  const briefs = await listTargetedBriefs(context, { limit: 1000 });
  const publicPackets = await listPackets(context, { includePrivate: false, limit: 1000 });
  const allPackets = await listPackets(context, { includePrivate: true, limit: 1000 });
  const privateSeedPackets = allPackets.filter((entry) => entry.packet.purpose === 'seed' && entry.packet.sensitivity === 'private');
  const inboxPackets = publicPackets.filter((entry) => entry.direction === 'inbox');
  const outboxPackets = publicPackets.filter((entry) => entry.direction === 'outbox');

  return {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    projectName: context.config.project.name,
    storePath: context.storePath,
    counts: {
      targetedBriefs: briefs.length,
      inboxPackets: inboxPackets.length,
      outboxPackets: outboxPackets.length,
      privateSeedPackets: privateSeedPackets.length,
      validationIssues: context.warnings.length,
    },
    recentInboxPackets: inboxPackets.slice(0, 5).map((entry) => ({
      id: entry.packet.id,
      title: entry.packet.title,
      originProject: entry.packet.origin.projectName,
      ...(entry.packet.importedAt ? { importedAt: entry.packet.importedAt } : {}),
      summary: entry.packet.summary,
    })),
    openBriefs: briefs.slice(0, 10).map((brief) => ({
      id: brief.id,
      title: brief.title,
      targetAgent: brief.targetAgent,
      tags: brief.tags,
    })),
    warnings: context.warnings,
  };
}
