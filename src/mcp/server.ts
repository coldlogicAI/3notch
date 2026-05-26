import { lstat } from 'node:fs/promises';
import path from 'node:path';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { Ajv2020 } from 'ajv/dist/2020.js';

import { parseArtifactFileSpec } from '../core/artifact-service.js';
import { createTargetedBrief, getProjectBrief, getTargetedBrief, listTargetedBriefs } from '../core/brief-service.js';
import { checkStore } from '../core/check-service.js';
import { loadConfig } from '../core/config-service.js';
import { runDoctor } from '../core/doctor-service.js';
import { createMark, createPacket, createReply, getPacket, listPackets } from '../core/packet-service.js';
import { createSeedPacket, importSeedPacket } from '../core/seed-service.js';
import { getStatus } from '../core/status-service.js';
import { importPacketFile } from '../core/transfer-service.js';
import { VERSION } from '../core/version.js';
import sharedSchema from '../schemas/shared.schema.json' with { type: 'json' };
import { getMcpToolInputSchema, mcpToolInputSchemas } from './tool-schemas.js';
import { assertMcpWritable, mcpErrorResult } from './errors.js';
import { NotchException } from '../types/errors.js';
import type { LoadedConfig } from '../core/config-service.js';
import type { PacketPurpose, ReplyType, Sensitivity, SourceLink } from '../types/records.js';

export type NotchMcpServerOptions = {
  cwd?: string;
  defaultActor?: string;
  includePrivate?: boolean;
  readOnly?: boolean;
  store?: string;
};

type ToolDefinition = {
  description: string;
  name: keyof typeof mcpToolInputSchemas;
  readOnly: boolean;
};

const toolDefinitions: ToolDefinition[] = [
  { name: 'get_brief', description: 'Read the default project brief.', readOnly: true },
  { name: 'create_brief', description: 'Create a targeted brief from explicit input.', readOnly: false },
  { name: 'list_briefs', description: 'List targeted briefs.', readOnly: true },
  { name: 'get_targeted_brief', description: 'Read a targeted brief by ID or slug.', readOnly: true },
  { name: 'create_packet', description: 'Create a packet from explicitly supplied context.', readOnly: false },
  { name: 'create_mark', description: 'Create a self-addressed private packet from explicit input.', readOnly: false },
  { name: 'create_reply', description: 'Create a typed packet reply to an existing record.', readOnly: false },
  { name: 'import_packet', description: 'Import an explicit packet file into the current store.', readOnly: false },
  { name: 'list_packets', description: 'List inbox and outbox packets.', readOnly: true },
  { name: 'get_packet', description: 'Read a packet by ID or slug.', readOnly: true },
  { name: 'create_seed_packet', description: 'Create a private seed packet from explicit input.', readOnly: false },
  { name: 'import_seed_packet', description: 'Import an explicit private seed packet file.', readOnly: false },
  { name: 'get_status', description: 'Return 3Notch project status.', readOnly: true },
  { name: 'check_store', description: 'Return deterministic corpus integrity findings.', readOnly: true },
  { name: 'run_doctor', description: 'Run 3Notch store diagnostics.', readOnly: true },
];

const ajv = new Ajv2020({ allErrors: true, strict: true });
ajv.addSchema(sharedSchema);

export function createNotchMcpServer(options: NotchMcpServerOptions = {}): Server {
  const server = new Server(
    { name: '3notch', version: VERSION },
    {
      capabilities: { tools: {} },
      instructions: '3Notch exposes local, explicit, reviewable context packet tools. It does not scrape chat history or execute shell commands.',
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: toolDefinitions.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: getMcpToolInputSchema(tool.name) as {
        type: 'object';
        properties?: Record<string, object>;
        required?: string[];
      },
      annotations: {
        readOnlyHint: tool.readOnly,
        destructiveHint: false,
        openWorldHint: false,
      },
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return await callTool(options, request.params.name, request.params.arguments ?? {});
    } catch (error) {
      return mcpErrorResult(error);
    }
  });

  return server;
}

async function callTool(
  options: NotchMcpServerOptions,
  toolName: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  if (!isV1ToolName(toolName)) {
    return mcpErrorResult(new Error(`Unknown 3Notch MCP tool: ${toolName}`));
  }

  validateToolArgs(toolName, args);

  const context = await loadConfig({
    ...(options.cwd ? { cwd: options.cwd } : {}),
    ...(options.store ? { store: options.store } : {}),
  });
  const definition = toolDefinitions.find((tool) => tool.name === toolName);

  if (!definition) {
    return mcpErrorResult(new Error(`Unknown 3Notch MCP tool: ${toolName}`));
  }

  if (!definition.readOnly) {
    assertMcpWritable(toolName, Boolean(options.readOnly), context.config.defaults.allowedMcpWriteTools);
  }

  if (toolName === 'run_doctor' && Boolean(args.fixDerivedState)) {
    assertMcpWritable(toolName, Boolean(options.readOnly), ['run_doctor']);
  }

  const data = await executeTool(context, options, toolName, args);
  return successResult(data);
}

async function executeTool(
  context: LoadedConfig,
  options: NotchMcpServerOptions,
  toolName: keyof typeof mcpToolInputSchemas,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  switch (toolName) {
    case 'get_brief': {
      const result = await getProjectBrief(context);
      return {
        brief: result.brief,
        ...(args.includeMarkdown ? { markdown: result.markdown } : {}),
        warnings: result.warnings,
      };
    }
    case 'create_brief': {
      return await createTargetedBrief(context, {
        agent: mcpActorName(args, options),
        designBasis: requiredString(args.designBasis, 'designBasis'),
        exclusions: stringArray(args.exclusions),
        goal: requiredString(args.goal, 'goal'),
        mcp: true,
        priorReasoningSummary: requiredString(args.priorReasoningSummary, 'priorReasoningSummary'),
        recommendedNextSteps: stringArray(args.recommendedNextSteps),
        relevantFiles: arrayArg<SourceLink>(args.relevantFiles),
        scope: objectArg(args.scope) as { files: string[]; topics: string[]; timeframe?: string },
        sourceTool: 'notch-mcp',
        tags: stringArray(args.tags),
        targetAgent: requiredString(args.targetAgent, 'targetAgent'),
        title: requiredString(args.title, 'title'),
      }) as unknown as Record<string, unknown>;
    }
    case 'list_briefs': {
      return {
        briefs: await listTargetedBriefs(context, {
          ...(args.limit ? { limit: Number(args.limit) } : {}),
          ...(args.status ? { status: String(args.status) } : {}),
          ...(args.tags ? { tags: stringArray(args.tags) } : {}),
          ...(args.targetAgent ? { targetAgent: String(args.targetAgent) } : {}),
        }),
      };
    }
    case 'get_targeted_brief': {
      const result = await getTargetedBrief(context, requiredString(args.id, 'id'));
      return {
        brief: result.brief,
        ...(args.includeMarkdown ? { markdown: result.markdown } : {}),
        warnings: [],
      };
    }
    case 'create_packet': {
      return await createPacket(context, {
        agent: mcpActorName(args, options),
        files: stringArray(args.files).map(parseArtifactFileSpec),
        includedRecords: arrayArg(args.include),
        ...(stringArg(args.importNotes) ? { importNotes: stringArg(args.importNotes) } : {}),
        ...(stringArg(args.nextSteps) ? { nextSteps: stringArg(args.nextSteps) } : {}),
        ...(stringArg(args.outputPath) ? { outputPath: stringArg(args.outputPath) } : {}),
        mcp: true,
        ...(enumArg<PacketPurpose>(args.purpose) ? { purpose: enumArg<PacketPurpose>(args.purpose) } : {}),
        ...(enumArg<Sensitivity>(args.sensitivity) ? { sensitivity: enumArg<Sensitivity>(args.sensitivity) } : {}),
        sourceLinks: [...arrayArg<SourceLink>(args.sourceLinks), ...stringArray(args.refs).map((file) => ({ kind: 'file' as const, path: file }))],
        sourceTool: 'notch-mcp',
        summary: requiredString(args.summary, 'summary'),
        ...(stringArg(args.task) ? { task: stringArg(args.task) } : {}),
        title: requiredString(args.title, 'title'),
        ...(stringArg(args.toAgent) ? { toAgent: stringArg(args.toAgent) } : {}),
        ...(stringArg(args.toPerson) ? { toPerson: stringArg(args.toPerson) } : {}),
        ...(stringArg(args.toRepo) ? { toRepo: stringArg(args.toRepo) } : {}),
      }) as unknown as Record<string, unknown>;
    }
    case 'create_mark': {
      return await createMark(context, {
        agent: mcpActorName(args, options),
        mcp: true,
        sourceLinks: arrayArg<SourceLink>(args.sourceLinks),
        sourceTool: 'notch-mcp',
        summary: requiredString(args.summary, 'summary'),
        ...(stringArg(args.supersedes) ? { supersedes: stringArg(args.supersedes) } : {}),
        tags: stringArray(args.tags),
        ...(stringArg(args.title) ? { title: stringArg(args.title) } : {}),
      }) as unknown as Record<string, unknown>;
    }
    case 'create_reply': {
      return await createReply(context, {
        agent: mcpActorName(args, options),
        files: stringArray(args.files).map(parseArtifactFileSpec),
        mcp: true,
        ...(stringArg(args.nextSteps) ? { nextSteps: stringArg(args.nextSteps) } : {}),
        parentId: requiredString(args.parentId, 'parentId'),
        private: Boolean(args.private),
        replyType: requiredString(args.replyType, 'replyType') as ReplyType,
        sourceLinks: [...arrayArg<SourceLink>(args.sourceLinks), ...stringArray(args.refs).map((file) => ({ kind: 'file' as const, path: file }))],
        sourceTool: 'notch-mcp',
        summary: requiredString(args.summary, 'summary'),
        tags: stringArray(args.tags),
        ...(stringArg(args.title) ? { title: stringArg(args.title) } : {}),
        ...(stringArg(args.toAgent) ? { toAgent: stringArg(args.toAgent) } : {}),
        ...(stringArg(args.toPerson) ? { toPerson: stringArg(args.toPerson) } : {}),
        ...(stringArg(args.toRepo) ? { toRepo: stringArg(args.toRepo) } : {}),
      }) as unknown as Record<string, unknown>;
    }
    case 'import_packet': {
      return await importPacketFile(context, await assertSafeMcpPacketPath(requiredString(args.packetPath, 'packetPath')), {
        actor: mcpActorName(args, options),
        asReviewed: Boolean(args.asReviewed),
        mcp: true,
        sourceTool: 'notch-mcp',
      }) as unknown as Record<string, unknown>;
    }
    case 'list_packets': {
      return {
        packets: await listPackets(context, {
          direction: enumArg<'inbox' | 'outbox' | 'both'>(args.direction) ?? 'both',
          includePrivate: Boolean(args.includePrivate) && Boolean(options.includePrivate),
          ...(args.limit ? { limit: Number(args.limit) } : {}),
          ...(enumArg<PacketPurpose>(args.purpose) ? { purpose: enumArg<PacketPurpose>(args.purpose) } : {}),
        }),
        warnings: Boolean(args.includePrivate) && !options.includePrivate
          ? [{ code: 'NOTCH_PRIVATE_HIDDEN', message: 'Private packets require --include-private.', severity: 'warn' }]
          : [],
      };
    }
    case 'get_packet': {
      const result = await getPacket(context, requiredString(args.id, 'id'), {
        direction: enumArg<'inbox' | 'outbox' | 'both'>(args.direction) ?? 'both',
        includePrivate: Boolean(args.includePrivate) && Boolean(options.includePrivate),
      });
      return {
        packet: result.packet,
        ...(args.includeMarkdown ? { markdown: result.markdown } : {}),
        warnings: [],
      };
    }
    case 'create_seed_packet': {
      return await createSeedPacket(context, {
        agent: mcpActorName(args, options),
        importNotes: 'Created from MCP create_seed_packet.',
        mcp: true,
        ...(stringArg(args.outputPath) ? { outputPath: stringArg(args.outputPath) } : {}),
        sourceLinks: arrayArg<SourceLink>(args.sourceLinks),
        sourceTool: 'notch-mcp',
        summary: requiredString(args.summary, 'summary'),
        title: requiredString(args.title, 'title'),
      }) as unknown as Record<string, unknown>;
    }
    case 'import_seed_packet': {
      return await importSeedPacket(context, await assertSafeMcpPacketPath(requiredString(args.packetPath, 'packetPath')), {
        actor: mcpActorName(args, options),
        asReviewed: Boolean(args.asReviewed),
        mcp: true,
        sourceTool: 'notch-mcp',
      }) as unknown as Record<string, unknown>;
    }
    case 'get_status': {
      return await getStatus(context) as unknown as Record<string, unknown>;
    }
    case 'check_store': {
      return await checkStore(context, { includePrivate: Boolean(options.includePrivate) }) as unknown as Record<string, unknown>;
    }
    case 'run_doctor': {
      return await runDoctor(context, {
        fix: Boolean(args.fixDerivedState),
        strict: Boolean(args.strict),
      }) as unknown as Record<string, unknown>;
    }
  }

  throw new Error(`Unhandled 3Notch MCP tool: ${toolName}`);
}

function validateToolArgs(toolName: keyof typeof mcpToolInputSchemas, args: Record<string, unknown>): void {
  const validate = ajv.compile(getMcpToolInputSchema(toolName));

  if (!validate(args)) {
    throw new Error(`Invalid arguments for ${toolName}: ${ajv.errorsText(validate.errors)}`);
  }
}

function successResult(data: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function isV1ToolName(toolName: string): toolName is keyof typeof mcpToolInputSchemas {
  return toolName in mcpToolInputSchemas;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required field: ${field}`);
  }

  return value;
}

function stringArg(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function arrayArg<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function objectArg(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function enumArg<T extends string>(value: unknown): T | undefined {
  return typeof value === 'string' ? value as T : undefined;
}

function mcpActorName(args: Record<string, unknown>, options: NotchMcpServerOptions): string {
  return stringArg(args.actorName) ?? options.defaultActor ?? 'mcp-client';
}

async function assertSafeMcpPacketPath(packetPath: string): Promise<string> {
  if (!path.isAbsolute(packetPath)) {
    throw new NotchException({
      code: 'NOTCH_MCP_PACKET_PATH_INVALID',
      message: 'MCP packet imports require an absolute packet path.',
      path: packetPath,
      recovery: 'Pass an absolute path to a packet Markdown file selected by the user.',
      severity: 'error',
      exitCode: 4,
    });
  }

  const stat = await lstat(packetPath);

  if (stat.isSymbolicLink()) {
    throw new NotchException({
      code: 'NOTCH_SYMLINK_REJECTED',
      message: `MCP packet imports do not follow symlinks: ${packetPath}`,
      path: packetPath,
      recovery: 'Pass the real packet file path instead of a symlink.',
      severity: 'error',
      exitCode: 5,
    });
  }

  return packetPath;
}
