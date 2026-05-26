import path from 'node:path';

export const DEFAULT_STORE_DIR = '.notch';

export type StorePaths = {
  brief: string;
  briefs: string;
  config: string;
  inbox: string;
  index: string;
  logs: string;
  manifest: string;
  outbox: string;
  privateInbox: string;
  privateOutbox: string;
  recordsIndex: string;
  relationships: string;
  store: string;
};

export const sourceRecordDirs = ['briefs', 'inbox', 'outbox', 'private/inbox', 'private/outbox'] as const;
export const requiredStoreDirs = ['briefs', 'inbox', 'outbox', 'private/inbox', 'private/outbox', 'index', 'logs'] as const;

export function getStorePaths(storePath: string): StorePaths {
  return {
    brief: path.join(storePath, 'brief.md'),
    briefs: path.join(storePath, 'briefs'),
    config: path.join(storePath, 'config.json'),
    inbox: path.join(storePath, 'inbox'),
    index: path.join(storePath, 'index'),
    logs: path.join(storePath, 'logs'),
    manifest: path.join(storePath, 'index/manifest.json'),
    outbox: path.join(storePath, 'outbox'),
    privateInbox: path.join(storePath, 'private/inbox'),
    privateOutbox: path.join(storePath, 'private/outbox'),
    recordsIndex: path.join(storePath, 'index/records.json'),
    relationships: path.join(storePath, 'index/relationships.json'),
    store: storePath,
  };
}

export function toStoreRelativePath(storePath: string, filePath: string): string {
  return path.relative(storePath, filePath).split(path.sep).join('/');
}

export function packetFolderPath(directory: string, slug: string): string {
  return path.join(directory, slug.replace(/\.md$/, ''));
}

export function packetMarkdownPath(packetFolder: string): string {
  return path.join(packetFolder, 'packet.md');
}

export function packetManifestPath(packetFolder: string): string {
  return path.join(packetFolder, 'manifest.json');
}

export function packetArtifactsPath(packetFolder: string): string {
  return path.join(packetFolder, 'artifacts');
}

export function packetRootPath(markdownPath: string): string {
  return path.basename(markdownPath) === 'packet.md' ? path.dirname(markdownPath) : markdownPath;
}

export function packetSlugFromMarkdownPath(markdownPath: string): string {
  return path.basename(markdownPath) === 'packet.md'
    ? path.basename(path.dirname(markdownPath))
    : path.basename(markdownPath, '.md');
}
