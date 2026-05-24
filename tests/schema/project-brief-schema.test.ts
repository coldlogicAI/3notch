import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseAndValidateRecord } from '../../src/core/record-parser.js';
import type { ProjectBrief } from '../../src/types/records.js';

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures');

describe('project brief schema', () => {
  it('accepts a project brief with required frontmatter and body headings', async () => {
    const markdown = await readFile(path.join(fixturesDir, 'valid-project-brief.md'), 'utf8');
    const result = parseAndValidateRecord<ProjectBrief>(markdown, 'valid-project-brief.md');

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.recordType : undefined).toBe('project_brief');
  });

  it('rejects a project brief that is missing required body headings', async () => {
    const markdown = await readFile(path.join(fixturesDir, 'invalid-project-brief-missing-heading.md'), 'utf8');
    const result = parseAndValidateRecord<ProjectBrief>(markdown, 'invalid-project-brief-missing-heading.md');

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.map((error) => error.code)).toContain('NOTCH_RECORD_INVALID');
  });
});
