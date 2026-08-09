import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../..');

describe('release-check script', () => {
  it('passes internal surface checks for the current package version', async () => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ['scripts/release-check.mjs'],
      { cwd: root },
    );

    expect(stderr).toBe('');
    expect(stdout).toContain('PASS package.json version:');
    expect(stdout).toContain('PASS package-lock.json version:');
    expect(stdout).toContain('PASS CHANGELOG section:');
    expect(stdout).toContain('PASS site softwareVersion:');
    expect(stdout).toMatch(/release-check: \d+ pass, \d+ warn, 0 fail/);
  });
});
