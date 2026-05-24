import { describe, expect, it } from 'vitest';

import { assertNoSecrets, scanForSecrets } from '../../src/core/secret-scan-service.js';
import { isNotchException } from '../../src/types/errors.js';

describe('secret scan service', () => {
  it('detects configured secret words, JWTs, private keys, and token-like strings', () => {
    expect(scanForSecrets('api_key=abc')).toEqual([
      expect.objectContaining({ code: 'NOTCH_SECRET_DETECTED' }),
    ]);
    expect(scanForSecrets('eyJabc.def.ghi')).toEqual([
      expect.objectContaining({ pattern: 'jwt' }),
    ]);
    expect(scanForSecrets('-----BEGIN OPENSSH PRIVATE KEY-----')).toEqual([
      expect.objectContaining({ pattern: 'private-key' }),
    ]);
    expect(scanForSecrets('tokenvalue ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef012345')).toEqual(
      expect.arrayContaining([expect.objectContaining({ pattern: 'token-like' })]),
    );
    expect(scanForSecrets('ghp_aaaabbbbccccddddeeeeffff1234567890aaaa')).toEqual(
      expect.arrayContaining([expect.objectContaining({ pattern: 'known-token' })]),
    );
    expect(scanForSecrets('ghp_aaaabbbbccccddddeeeeffff1234567890aaaa')).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ pattern: 'token-like' })]),
    );
    expect(scanForSecrets('abcdefghijklmnopqrstuvwxyzabcdef1234567890')).toEqual(
      expect.arrayContaining([expect.objectContaining({ pattern: 'token-like' })]),
    );
  });

  it('throws NOTCH_SECRET_DETECTED before writes', () => {
    expect(() => assertNoSecrets('password: abc')).toThrow('Content matched configured secret pattern');
  });

  it('includes location context and a rephrase hint for benign prose matches', () => {
    try {
      assertNoSecrets('Document how to rotate a password value.', undefined, {
        field: 'docs',
        path: 'example.md',
      });
      throw new Error('Expected assertNoSecrets to throw.');
    } catch (error) {
      expect(isNotchException(error)).toBe(true);

      if (isNotchException(error)) {
        expect(error.notchError.message).toMatch(/File: example\.md\..*Field: docs\..*Line: 1\./);
        expect(error.notchError.recovery).toMatch(/rephrase trigger words/i);
      }
    }
  });

  it('does not flag generated 3Notch identifiers as token-like secrets', () => {
    expect(scanForSecrets('packet_20260524T040512Z_repo_state')).toEqual([]);
    expect(scanForSecrets('20260524T040512Z-repo-state-to-codex')).toEqual([]);
  });
});
