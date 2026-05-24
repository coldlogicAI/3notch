import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseAndValidateRecord } from '../../src/core/record-parser.js';
import type { NotchBrief } from '../../src/types/records.js';

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures');

describe('targeted brief schema', () => {
  it('accepts a complete targeted brief', async () => {
    const markdown = await readFile(path.join(fixturesDir, 'valid-targeted-brief.md'), 'utf8');
    const result = parseAndValidateRecord<NotchBrief>(markdown, 'valid-targeted-brief.md');

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.targetAgent : undefined).toBe('codex');
  });

  it('rejects a brief missing the goal metadata and goal heading', async () => {
    const markdown = await readFile(path.join(fixturesDir, 'invalid-targeted-brief-missing-goal.md'), 'utf8');
    const result = parseAndValidateRecord<NotchBrief>(markdown, 'invalid-targeted-brief-missing-goal.md');

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.map((error) => error.message).join('\n')).toContain('## Goal For');
  });
});
