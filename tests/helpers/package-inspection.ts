import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const repoRoot = path.resolve(import.meta.dirname, '../..');

export async function readRepoFile(relativePath: string): Promise<string> {
  return await readFile(path.join(repoRoot, relativePath), 'utf8');
}

export async function readJsonRepoFile<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readRepoFile(relativePath)) as T;
}
