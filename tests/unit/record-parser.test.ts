import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseAndValidateRecord, parseRecordMarkdown } from '../../src/core/record-parser.js';
import type { NotchPacket } from '../../src/types/records.js';

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures');

describe('record parser', () => {
  it('parses YAML frontmatter and coerces scalar schemaVersion values to strings', async () => {
    const markdown = `---\nid: packet_scalar_version\nschemaVersion: 1.0\nrecordType: packet\n---\n\n## Summary\n`;
    const result = parseRecordMarkdown(markdown);

    expect(result.ok).toBe(true);
    expect(result.ok ? result.record.metadata.schemaVersion : undefined).toBe('1');
  });

  it('returns NOTCH_CORRUPT_RECORD for bad YAML', async () => {
    const markdown = await readFile(path.join(fixturesDir, 'bad-yaml.md'), 'utf8');
    const result = parseRecordMarkdown(markdown, 'bad-yaml.md');

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.map((error) => error.code)).toContain('NOTCH_CORRUPT_RECORD');
  });

  it('returns NOTCH_RECORD_INVALID for missing required packet headings', async () => {
    const markdown = await readFile(path.join(fixturesDir, 'missing-required-heading.md'), 'utf8');
    const result = parseAndValidateRecord<NotchPacket>(markdown, 'missing-required-heading.md');

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.map((error) => error.code)).toContain('NOTCH_RECORD_INVALID');
  });
});
