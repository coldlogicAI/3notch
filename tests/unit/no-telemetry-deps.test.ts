import { describe, expect, it } from 'vitest';

import { readJsonRepoFile, readRepoFile } from '../helpers/package-inspection.js';

const forbiddenDirectDeps = ['analytics', 'mixpanel', 'posthog', 'segment', 'sentry', '@sentry/node'];
const forbiddenInstalledPackages = [
  ...forbiddenDirectDeps,
  '@opentelemetry/api',
  'analytics-node',
  'posthog-node',
  'segmentio',
];
const forbiddenSourceUsages = ['mixpanel', 'posthog', 'segment.com', '@sentry', 'sentry.init', 'analytics.track'];

describe('telemetry dependency guard', () => {
  it('does not include direct telemetry dependencies', async () => {
    const packageJson = await readJsonRepoFile<{
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    }>('package.json');
    const directDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    for (const forbidden of forbiddenDirectDeps) {
      expect(Object.keys(directDeps)).not.toContain(forbidden);
    }
  });

  it('does not install telemetry packages in the lockfile', async () => {
    const packageLock = await readJsonRepoFile<{
      packages?: Record<string, unknown>;
    }>('package-lock.json');
    const lockedPackagePaths = new Set(Object.keys(packageLock.packages ?? {}));

    for (const forbidden of forbiddenInstalledPackages) {
      expect(lockedPackagePaths).not.toContain(`node_modules/${forbidden}`);
    }
  });

  it('does not include telemetry client usage in source or built output', async () => {
    const sourceFiles = [
      'src/cli/index.ts',
      'src/cli/program.ts',
      'src/mcp/server.ts',
      'src/core/secret-scan-service.ts',
      'dist/cli/index.js',
    ];
    const combined = (await Promise.all(sourceFiles.map((file) => readRepoFile(file).catch(() => '')))).join('\n').toLowerCase();

    for (const forbidden of forbiddenSourceUsages) {
      expect(combined).not.toContain(forbidden);
    }
  });
});
