import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Command } from 'commander';

import { getCliContext } from '../context.js';
import { mcpInstructions } from '../mcp-instructions.js';
import { printInfo, printJson } from '../output.js';
import { resolveProjectRoot } from '../../core/config-service.js';
import { getStorePaths, requiredStoreDirs } from '../../core/store-layout.js';
import { NotchException } from '../../types/errors.js';
import type { NotchConfig, ProjectBrief } from '../../types/records.js';
import { renderMarkdownRecord } from '../../core/store-service.js';

type OnboardOptions = {
  force?: boolean;
  mcp?: string;
  name?: string;
  yes?: boolean;
};

export function registerOnboardCommand(program: Command): void {
  program
    .command('onboard')
    .description('initialize a local .notch store')
    .option('--name <project>', 'project name for the 3Notch config')
    .option('--yes', 'create starter files without prompting')
    .option('--mcp <client>', 'print MCP setup instructions for a client')
    .option('--force', 'repair missing starter files without overwriting existing source records')
    .action(async (options: OnboardOptions, command: Command) => {
      const context = getCliContext(command);
      const cwd = path.resolve(context.cwd ?? process.cwd());
      const projectRoot = await resolveProjectRoot(cwd);
      const projectName = options.name ?? path.basename(projectRoot);
      const storePath = context.store ? path.resolve(cwd, context.store) : path.join(projectRoot, '.notch');
      const paths = getStorePaths(storePath);
      const storeExists = await exists(storePath);
      const configExists = await exists(paths.config);

      if (storeExists && !configExists && !options.force) {
        throw new NotchException({
          code: 'NOTCH_CONFIG_INVALID',
          message: '.notch exists but config.json is missing.',
          path: storePath,
          recovery: 'Re-run notch onboard --force to repair missing starter files.',
          severity: 'error',
          exitCode: 1,
        });
      }

      if (configExists && !options.force) {
        if (context.output.json) {
          printJson({ alreadyInitialized: true, storePath });
        } else {
          printInfo(`3Notch store already initialized at ${storePath}`, context.output);
        }
        return;
      }

      await mkdir(storePath, { recursive: true });

      for (const dir of requiredStoreDirs) {
        await mkdir(path.join(storePath, dir), { recursive: true });
      }

      await writeIfMissing(path.join(storePath, '.gitignore'), 'index/\nlogs/\nprivate/\n');
      await writeIfMissing(paths.config, `${JSON.stringify(defaultConfig(projectName, projectRoot), null, 2)}\n`);
      await writeIfMissing(paths.brief, renderMarkdownRecord(defaultProjectBrief(projectName), defaultProjectBriefBody()));

      const output = {
        created: !configExists,
        projectName,
        storePath,
        mcpInstructions: options.mcp && options.mcp !== 'none' ? mcpInstructions(storePath) : undefined,
      };

      if (context.output.json) {
        printJson(output);
        return;
      }

      printInfo(`Initialized 3Notch store at ${storePath}`, context.output);

      if (output.mcpInstructions) {
        printInfo(`\n${output.mcpInstructions}`, context.output);
      }
    });
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeIfMissing(filePath: string, content: string): Promise<void> {
  if (await exists(filePath)) {
    return;
  }

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

function defaultConfig(projectName: string, projectRoot: string): NotchConfig {
  return {
    schemaVersion: '1.0.0',
    project: {
      name: projectName,
      root: projectRoot,
    },
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
  };
}

function defaultProjectBrief(projectName: string): ProjectBrief {
  return {
    id: `project_brief_${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '_') || 'project'}`,
    schemaVersion: '1.0.0',
    recordType: 'project_brief',
    status: 'active',
    projectName,
    createdAt: new Date().toISOString(),
    createdBy: {
      actorType: 'human',
      name: 'unknown',
    },
    sourceTool: {
      name: 'notch-cli',
    },
    tags: [],
    sourceLinks: [],
    reviewStatus: 'reviewed',
    currentFocus: [],
    activeConstraints: [],
    recentActivity: [],
    openThreads: [],
    warnings: [],
  };
}

function defaultProjectBriefBody(): string {
  return `## Current Focus

- Replace this with the current project focus.

## Active Constraints

- Replace this with constraints agents must respect.

## Recent Activity

- Replace this with recent work.

## Open Threads

- Replace this with open follow-ups.

## Warnings

- None.
`;
}
