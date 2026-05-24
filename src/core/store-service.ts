import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

import { parseAndValidateRecord, parseRecordMarkdown, type ParsedRecord, type RecordParserResult } from './record-parser.js';
import { sourceRecordDirs, toStoreRelativePath } from './store-layout.js';
import { NotchException } from '../types/errors.js';

export type WriteRecordOptions = {
  content: string;
  directory: string;
  explicitSlug?: boolean;
  extension?: string;
  slug: string;
};

export type WrittenRecord = {
  path: string;
  relativePath: string;
};

export type ScannedRecord = RecordParserResult & {
  path: string;
  relativePath: string;
};

export async function ensureDir(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
}

export async function atomicWriteFile(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.tmp`);
  await writeFile(tempPath, content, 'utf8');
  await rename(tempPath, filePath);
}

export async function writeRecordWithCollisionHandling(
  storePath: string,
  options: WriteRecordOptions,
): Promise<WrittenRecord> {
  const extension = options.extension ?? '.md';
  const filename = await uniqueFilename(options.directory, options.slug, extension, options.explicitSlug ?? false);
  const filePath = path.join(options.directory, filename);

  await atomicWriteFile(filePath, options.content);

  return {
    path: filePath,
    relativePath: toStoreRelativePath(storePath, filePath),
  };
}

export async function scanMarkdownRecords(
  storePath: string,
  options: { includeInvalid?: boolean; includePrivate?: boolean } = {},
): Promise<ScannedRecord[]> {
  const dirs = sourceRecordDirs.filter((dir) => options.includePrivate || !dir.startsWith('private/'));
  const files: string[] = [];

  for (const dir of dirs) {
    const absoluteDir = path.join(storePath, dir);

    if (!(await exists(absoluteDir))) {
      continue;
    }

    files.push(...(await markdownFiles(absoluteDir)));
  }

  const briefPath = path.join(storePath, 'brief.md');

  if (await exists(briefPath)) {
    files.push(briefPath);
  }

  const results = await Promise.all(
    files.map(async (filePath) => {
      const markdown = await readFile(filePath, 'utf8');
      const parsed = options.includeInvalid
        ? parseRecordMarkdown(markdown, filePath)
        : parseAndValidateRecord(markdown, filePath);

      return normalizeScannedRecord(parsed, filePath, toStoreRelativePath(storePath, filePath));
    }),
  );

  return options.includeInvalid ? results : results.filter((result) => result.ok);
}

function normalizeScannedRecord(
  parsed: ReturnType<typeof parseRecordMarkdown> | ReturnType<typeof parseAndValidateRecord>,
  filePath: string,
  relativePath: string,
): ScannedRecord {
  if (!parsed.ok) {
    return { ...parsed, path: filePath, relativePath };
  }

  if ('record' in parsed) {
    return { ...parsed, path: filePath, relativePath };
  }

  const record: ParsedRecord = {
    body: parsed.body ?? '',
    metadata: parsed.data as Record<string, unknown>,
    path: filePath,
  };

  return {
    ok: true,
    path: filePath,
    record,
    relativePath,
    warnings: parsed.warnings,
  };
}

export function renderMarkdownRecord(frontmatter: Record<string, unknown>, body: string): string {
  return `---\n${YAML.stringify(frontmatter).trimEnd()}\n---\n\n${body.trimStart()}`;
}

async function uniqueFilename(
  directory: string,
  slug: string,
  extension: string,
  explicitSlug: boolean,
): Promise<string> {
  const base = slug.endsWith(extension) ? slug.slice(0, -extension.length) : slug;
  let candidate = `${base}${extension}`;
  let suffix = 2;

  while (await exists(path.join(directory, candidate))) {
    if (explicitSlug) {
      throw new NotchException({
        code: 'NOTCH_WRITE_FAILED',
        message: `Record already exists for explicit slug: ${slug}`,
        path: path.join(directory, candidate),
        recovery: 'Choose another slug or omit the slug to allow automatic suffixing.',
        severity: 'error',
        exitCode: 1,
      });
    }

    candidate = `${base}-${suffix}${extension}`;
    suffix += 1;
  }

  return candidate;
}

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return await markdownFiles(filePath);
      }

      return entry.isFile() && entry.name.endsWith('.md') ? [filePath] : [];
    }),
  );

  return files.flat();
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}
