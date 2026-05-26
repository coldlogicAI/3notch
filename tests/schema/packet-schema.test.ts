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

  it('validates explicit packet relationship fields', async () => {
    const markdown = await readFile(path.join(fixturesDir, 'valid-packet.md'), 'utf8');
    const related = markdown.replace(
      'summary: Carries schema implementation context into another repo.',
      [
        'summary: Carries schema implementation context into another repo.',
        'supersedes: packet_previous_slice',
        'replyTo: packet_parent_slice',
        'replyType: question',
      ].join('\n'),
    ).replace('status: active', 'status: open');
    const result = parseAndValidateRecord<NotchPacket>(related, 'related-packet.md');

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.supersedes : undefined).toBe('packet_previous_slice');
    expect(result.ok ? result.data.replyType : undefined).toBe('question');
  });

  it('accepts nextSteps and well-formed artifact entries', async () => {
    const markdown = await readFile(path.join(fixturesDir, 'valid-packet.md'), 'utf8');
    const bundled = markdown.replace(
      'summary: Carries schema implementation context into another repo.',
      [
        'summary: Carries schema implementation context into another repo.',
        'nextSteps: Build the receiving feature from artifacts/showcase.html.',
        'artifacts:',
        '  - path: artifacts/showcase.html',
        '    sha256: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '    bytes: 42',
        '    purpose: source',
      ].join('\n'),
    );
    const result = parseAndValidateRecord<NotchPacket>(bundled, 'artifact-packet.md');

    expect(result.ok).toBe(true);
    expect(result.ok ? result.data.nextSteps : undefined).toContain('Build the receiving feature');
    expect(result.ok ? result.data.artifacts?.[0]?.purpose : undefined).toBe('source');
  });

  it('rejects unsafe artifact paths and malformed hashes', async () => {
    const markdown = await readFile(path.join(fixturesDir, 'valid-packet.md'), 'utf8');
    const unsafe = markdown.replace(
      'summary: Carries schema implementation context into another repo.',
      [
        'summary: Carries schema implementation context into another repo.',
        'artifacts:',
        '  - path: ../secret.txt',
        '    sha256: not-a-hash',
        '    bytes: -1',
        '    purpose: source',
      ].join('\n'),
    );

    expect(parseAndValidateRecord<NotchPacket>(unsafe, 'unsafe-artifact.md').ok).toBe(false);
  });

  it('rejects malformed relationship IDs and reply fields without replyTo', async () => {
    const markdown = await readFile(path.join(fixturesDir, 'valid-packet.md'), 'utf8');
    const malformed = markdown.replace(
      'summary: Carries schema implementation context into another repo.',
      'summary: Carries schema implementation context into another repo.\nsupersedes: "not a valid id"',
    );
    const orphanReplyType = markdown.replace(
      'summary: Carries schema implementation context into another repo.',
      'summary: Carries schema implementation context into another repo.\nreplyType: question',
    );

    expect(parseAndValidateRecord<NotchPacket>(malformed, 'malformed.md').ok).toBe(false);
    expect(parseAndValidateRecord<NotchPacket>(orphanReplyType, 'orphan-reply.md').ok).toBe(false);
  });
});
