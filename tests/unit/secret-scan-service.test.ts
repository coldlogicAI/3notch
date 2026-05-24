import { describe, expect, it } from 'vitest';

import { assertNoSecrets, scanForSecrets } from '../../src/core/secret-scan-service.js';

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
  });

  it('throws NOTCH_SECRET_DETECTED before writes', () => {
    expect(() => assertNoSecrets('password: abc')).toThrow('Content matched configured secret pattern');
  });

  it('does not flag generated 3Notch identifiers as token-like secrets', () => {
    expect(scanForSecrets('packet_20260524T040512Z_repo_state')).toEqual([]);
    expect(scanForSecrets('20260524T040512Z-repo-state-to-codex')).toEqual([]);
  });
});
