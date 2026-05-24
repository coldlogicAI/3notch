import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { notchMcpServerDefinition } from './mcp-instructions.js';

type ClaudeDesktopConfig = {
  mcpServers?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ClaudeDesktopMcpConfigResult = {
  backupPath?: string;
  configPath?: string;
  instructions?: string;
  serverName: '3notch';
  wrote: boolean;
};

const configHomeEnv = 'NOTCH_CLAUDE_DESKTOP_CONFIG_HOME';

export async function configureClaudeDesktopMcp(storePath: string): Promise<ClaudeDesktopMcpConfigResult> {
  const configHome = claudeDesktopConfigHome();

  if (!configHome) {
    return {
      instructions: 'Claude Desktop config auto-detection is unavailable on this platform. Use the printed MCP setup snippet instead.',
      serverName: '3notch',
      wrote: false,
    };
  }

  const configPath = path.join(configHome, 'claude_desktop_config.json');
  const existing = await readJsonIfExists(configPath);
  const backupPath = await backupIfExists(configPath);
  const nextConfig: ClaudeDesktopConfig = {
    ...existing,
    mcpServers: {
      ...(existing.mcpServers ?? {}),
      '3notch': notchMcpServerDefinition(storePath),
    },
  };

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');

  return {
    ...(backupPath ? { backupPath } : {}),
    configPath,
    serverName: '3notch',
    wrote: true,
  };
}

function claudeDesktopConfigHome(): string | undefined {
  const override = process.env[configHomeEnv];

  if (override) {
    return override;
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/Claude');
  }

  if (process.platform === 'win32') {
    return process.env.APPDATA ? path.join(process.env.APPDATA, 'Claude') : undefined;
  }

  return undefined;
}

async function readJsonIfExists(filePath: string): Promise<ClaudeDesktopConfig> {
  if (!(await exists(filePath))) {
    return {};
  }

  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as ClaudeDesktopConfig;

  return typeof parsed === 'object' && parsed !== null ? parsed : {};
}

async function backupIfExists(filePath: string): Promise<string | undefined> {
  if (!(await exists(filePath))) {
    return undefined;
  }

  const backupPath = `${filePath}.bak`;
  await copyFile(filePath, backupPath);
  return backupPath;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
