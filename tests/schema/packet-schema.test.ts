import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parseAndValidateRecord } from '../../src/core/record-parser.js';
import type { NotchPacket } from '../../src/types/records.js';

const fixturesDir = path.resolve(import.meta.dirname, '../fixtures');

describe('packet schema', () => {
  it('accepts a handoff packet with origin, recipient, summary, and included refs', async () => {
    const markdown = await readFile(path.join(fixturesDir, 'valid-packet.md'), 'utf8');
    const result = parseAndValidateRecord<NotchPacket>(markdown, 'valid-packet.md');

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.purpose : undefined).toBe('handoff');
  });

  it('accepts a private seed packet', async () => {
    const markdown = await readFile(path.join(fixturesDir, 'valid-seed-packet.md'), 'utf8');
    const result = parseAndValidateRecord<NotchPacket>(markdown, 'valid-seed-packet.md');

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.sensitivity : undefined).toBe('private');
  });

  it('rejects packets missing origin metadata', async () => {
    const markdown = await readFile(path.join(fixturesDir, 'invalid-packet-missing-origin.md'), 'utf8');
    const result = parseAndValidateRecord<NotchPacket>(markdown, 'invalid-packet-missing-origin.md');

    expect(result.ok).toBe(false);
    expect(result.ok ? '' : JSON.stringify(result.errors)).toContain('origin');
  });
});
