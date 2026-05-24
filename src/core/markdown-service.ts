import matter from 'gray-matter';

import type { NotchError } from '../types/errors.js';

export type MarkdownParseResult =
  | { body: string; data: Record<string, unknown>; ok: true }
  | { errors: NotchError[]; ok: false };

export function parseMarkdownWithFrontmatter(markdown: string, path?: string): MarkdownParseResult {
  try {
    const parsed = matter(markdown);
    const data = normalizeFrontmatter(parsed.data as Record<string, unknown>);

    return {
      body: parsed.content.trimStart(),
      data,
      ok: true,
    };
  } catch (error) {
    return {
      errors: [
        {
          code: 'NOTCH_CORRUPT_RECORD',
          message: error instanceof Error ? error.message : 'Record frontmatter could not be parsed.',
          ...(path ? { path } : {}),
          recovery: 'Fix the YAML frontmatter syntax.',
          severity: 'error',
          exitCode: 3,
        },
      ],
      ok: false,
    };
  }
}

export function hasMarkdownHeading(markdownBody: string, heading: string): boolean {
  const normalized = heading.trim();

  return markdownBody
    .split(/\r?\n/)
    .some((line) => line.trim().toLowerCase() === normalized.toLowerCase());
}

function normalizeFrontmatter(value: Record<string, unknown>): Record<string, unknown> {
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'schemaVersion' && entry !== undefined) {
      value[key] = String(entry);
      continue;
    }

    if (entry instanceof Date) {
      value[key] = entry.toISOString();
      continue;
    }

    if (Array.isArray(entry)) {
      value[key] = entry.map((item) => {
        if (item instanceof Date) {
          return item.toISOString();
        }

        if (typeof item === 'object' && item !== null) {
          return normalizeFrontmatter(item as Record<string, unknown>);
        }

        return item;
      });
      continue;
    }

    if (typeof entry === 'object' && entry !== null) {
      value[key] = normalizeFrontmatter(entry as Record<string, unknown>);
    }
  }

  return value;
}
