import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { notchMcpServerDefinition } from './mcp-instructions.js';

type McpJsonConfig = {
  mcpServers?: Record<string, unknown>;
  [key: string]: unknown;
};

export type McpConfigWriteResult = {
  backupPath?: string;
  configPath: string;
  serverName: '3notch';
  wrote: boolean;
};

export async function configureClaudeCodeMcp(projectRoot: string, storePath: string): Promise<McpConfigWriteResult> {
  const configPath = path.join(projectRoot, '.mcp.json');
  const existing = await readJsonIfExists(configPath);
  const backupPath = await backupIfExists(configPath);
  const nextConfig: McpJsonConfig = {
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

async function readJsonIfExists(filePath: string): Promise<McpJsonConfig> {
  if (!(await exists(filePath))) {
    return {};
  }

  const raw = await readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw) as McpJsonConfig;

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
