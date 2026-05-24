import { mkdir, symlink } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { assertNoSymlinksInside, assertSafeRelativePath, preserveOriginPathMetadata } from '../../src/core/path-safety.js';
import { createBareStore } from '../helpers/store-fixtures.js';
import { withTempProject } from '../helpers/temp-project.js';

describe('path safety', () => {
  it('accepts relative project paths and normalizes backslash separators', async () => {
    await withTempProject({}, async (project) => {
      const safePath = assertSafeRelativePath('src\\index.ts', project.path);

      expect(safePath.relativePath).toBe('src/index.ts');
      expect(safePath.absolutePath).toBe(path.join(project.path, 'src/index.ts'));
    });
  });

  it('rejects absolute, home, sibling traversal, and drive-letter paths', async () => {
    await withTempProject({}, async (project) => {
      for (const unsafePath of ['/tmp/file', '~/file', '../outside', 'C:\\outside\\file']) {
        expect(() => assertSafeRelativePath(unsafePath, project.path)).toThrow('Path must be relative');
      }
    });
  });

  it('rejects symlinks inside .notch', async () => {
    await withTempProject({}, async (project) => {
      const storePath = await createBareStore(project.path);
      await mkdir(path.join(project.path, 'outside'), { recursive: true });
      await symlink(path.join(project.path, 'outside'), path.join(storePath, 'linked'));

      await expect(assertNoSymlinksInside(storePath)).rejects.toMatchObject({
        notchError: { code: 'NOTCH_SYMLINK_REJECTED' },
      });
    });
  });

  it('preserves imported origin paths as metadata', () => {
    expect(preserveOriginPathMetadata('/other/repo/src/file.ts')).toBe('/other/repo/src/file.ts');
  });
});
