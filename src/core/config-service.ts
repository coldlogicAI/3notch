import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { schemaService } from './schema-service.js';
import { DEFAULT_STORE_DIR, getStorePaths, type StorePaths } from './store-layout.js';
import { NotchException, type NotchError } from '../types/errors.js';
import type { NotchConfig } from '../types/records.js';

export type ResolveStoreOptions = {
  cwd?: string;
  store?: string;
};

export type LoadedConfig = {
  config: NotchConfig;
  projectRoot: string;
  storePath: string;
  paths: StorePaths;
  warnings: NotchError[];
};

const knownConfigTopLevelFields = new Set([
  'schemaVersion',
  'project',
  'store',
  'privacy',
  'defaults',
  'artifacts',
  'continuation',
]);

export async function resolveProjectRoot(cwd = process.cwd()): Promise<string> {
  let current = path.resolve(cwd);

  while (true) {
    if (await exists(path.join(current, DEFAULT_STORE_DIR, 'config.json'))) {
      return current;
    }

    if (await exists(path.join(current, '.git'))) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return path.resolve(cwd);
    }

    current = parent;
  }
}

export async function resolveStorePath(options: ResolveStoreOptions = {}): Promise<{
  projectRoot: string;
  storePath: string;
}> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const projectRoot = await resolveProjectRoot(cwd);
  const storePath = options.store
    ? path.resolve(cwd, options.store)
    : path.join(projectRoot, DEFAULT_STORE_DIR);

  return { projectRoot, storePath };
}

export async function loadConfig(options: ResolveStoreOptions = {}): Promise<LoadedConfig> {
  const resolved = await resolveStorePath(options);
  const paths = getStorePaths(resolved.storePath);

  if (!(await exists(paths.config))) {
    throw new NotchException({
      code: 'NOTCH_STORE_NOT_FOUND',
      message: 'No .notch store was found for this project.',
      path: resolved.storePath,
      recovery: 'Run notch onboard.',
      severity: 'error',
      exitCode: 2,
    });
  }

  let raw: string;

  try {
    raw = await readFile(paths.config, 'utf8');
  } catch (error) {
    throw new NotchException({
      code: 'NOTCH_PERMISSION_DENIED',
      message: error instanceof Error ? error.message : 'Could not read .notch/config.json.',
      path: paths.config,
      recovery: 'Check file permissions for the 3Notch store.',
      severity: 'error',
      exitCode: 5,
    });
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new NotchException({
      code: 'NOTCH_CONFIG_INVALID',
      message: error instanceof Error ? error.message : 'Config JSON could not be parsed.',
      path: paths.config,
      recovery: 'Fix .notch/config.json.',
      severity: 'error',
      exitCode: 3,
    });
  }

  const validation = schemaService.validate<NotchConfig>('config', parsed, paths.config);

  if (!validation.ok) {
    const firstError = validation.errors[0] ?? {
      code: 'NOTCH_CONFIG_INVALID',
      message: 'Config is invalid.',
      severity: 'error' as const,
      exitCode: 1,
    };
    throw new NotchException({
      ...firstError,
      code: 'NOTCH_CONFIG_INVALID',
      exitCode: 1,
      path: paths.config,
    });
  }

  const warnings = unknownTopLevelConfigWarnings(validation.data, paths.config);

  return {
    config: validation.data,
    paths,
    projectRoot: resolved.projectRoot,
    storePath: resolved.storePath,
    warnings,
  };
}

export async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function unknownTopLevelConfigWarnings(config: NotchConfig, configPath: string): NotchError[] {
  return Object.keys(config)
    .filter((key) => !knownConfigTopLevelFields.has(key))
    .map((key) => ({
      code: 'NOTCH_CONFIG_UNKNOWN_FIELD',
      field: `/${key}`,
      message: `Unknown top-level config field: ${key}`,
      path: configPath,
      recovery: 'Remove the field or update 3Notch if it belongs to a newer schema.',
      severity: 'warn',
    }));
}
