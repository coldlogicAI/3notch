#!/usr/bin/env node
/**
 * Release surface check for @3notch/cli.
 *
 * Default (CI-safe): fail on internal version drift.
 * --with-npm: also report registry lag (warn by default).
 * --require-published: fail if npm latest !== package.json version.
 *
 * Usage:
 *   node scripts/release-check.mjs
 *   node scripts/release-check.mjs --with-npm
 *   node scripts/release-check.mjs --with-npm --require-published
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const withNpm = args.has('--with-npm');
const requirePublished = args.has('--require-published');

if (requirePublished && !withNpm) {
  args.add('--with-npm');
}

/** @type {{ ok: boolean; level: 'pass' | 'warn' | 'fail'; label: string; detail: string }[]} */
const results = [];

function pass(label, detail) {
  results.push({ ok: true, level: 'pass', label, detail });
}

function warn(label, detail) {
  results.push({ ok: true, level: 'warn', label, detail });
}

function fail(label, detail) {
  results.push({ ok: false, level: 'fail', label, detail });
}

async function readJson(relativePath) {
  const absolute = path.join(root, relativePath);
  return JSON.parse(await readFile(absolute, 'utf8'));
}

async function readText(relativePath) {
  return await readFile(path.join(root, relativePath), 'utf8');
}

function semverParts(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

function isOlderSemver(left, right) {
  const a = semverParts(left);
  const b = semverParts(right);
  if (!a || !b) {
    return false;
  }

  if (a.major !== b.major) {
    return a.major < b.major;
  }
  if (a.minor !== b.minor) {
    return a.minor < b.minor;
  }
  if (a.patch !== b.patch) {
    return a.patch < b.patch;
  }

  // Treat any prerelease as older than the same numbers without prerelease.
  if (a.prerelease && !b.prerelease) {
    return true;
  }
  if (!a.prerelease && b.prerelease) {
    return false;
  }
  return false;
}

async function checkPackageSurfaces() {
  const packageJson = await readJson('package.json');
  const lock = await readJson('package-lock.json');
  const version = packageJson.version;

  if (typeof version !== 'string' || !semverParts(version)) {
    fail('package.json version', `invalid semver: ${String(version)}`);
    return null;
  }

  pass('package.json version', version);

  if (lock.version !== version) {
    fail('package-lock.json version', `expected ${version}, found ${lock.version}`);
  } else {
    pass('package-lock.json version', lock.version);
  }

  const lockRoot = lock.packages?.['']?.version;
  if (lockRoot !== version) {
    fail('package-lock packages[""].version', `expected ${version}, found ${String(lockRoot)}`);
  } else {
    pass('package-lock packages[""].version', lockRoot);
  }

  if (packageJson.name !== '@3notch/cli') {
    fail('package name', `expected @3notch/cli, found ${String(packageJson.name)}`);
  } else {
    pass('package name', packageJson.name);
  }

  return { packageJson, version };
}

async function checkChangelog(version) {
  const changelog = await readText('CHANGELOG.md');
  const heading = `## [${version}]`;
  if (!changelog.includes(heading)) {
    fail(
      'CHANGELOG section',
      `missing "${heading}". Move Unreleased notes into a dated ${version} section before release.`,
    );
    return;
  }

  pass('CHANGELOG section', heading);

  // Unreleased may remain for in-progress work, but a release version must not
  // be only mentioned in Unreleased prose without its own heading.
  const unreleasedMatch = changelog.match(/## \[Unreleased\]([\s\S]*?)(?=\n## \[|$)/);
  if (unreleasedMatch?.[1]?.includes(heading)) {
    warn('CHANGELOG Unreleased', `${heading} also appears under Unreleased; tidy after cut.`);
  }
}

async function checkSiteVersion(version) {
  const indexHtml = await readText('site/public/index.html');
  const match = indexHtml.match(/"softwareVersion"\s*:\s*"([^"]+)"/);
  if (!match) {
    fail('site softwareVersion', 'softwareVersion field not found in site/public/index.html');
    return;
  }

  if (match[1] !== version) {
    fail('site softwareVersion', `expected ${version}, found ${match[1]}`);
    return;
  }

  pass('site softwareVersion', match[1]);
}

async function checkBuiltCli(version) {
  try {
    const { spawnSync } = await import('node:child_process');
    const cliPath = path.join(root, 'dist/cli/index.js');
    const result = spawnSync(process.execPath, [cliPath, '--version'], {
      encoding: 'utf8',
      cwd: root,
    });

    if (result.error || result.status !== 0) {
      warn(
        'built CLI --version',
        'dist/cli/index.js missing or failed; run npm run build before release publish.',
      );
      return;
    }

    const printed = (result.stdout ?? '').trim();
    if (printed !== version) {
      fail('built CLI --version', `expected ${version}, found ${printed || '(empty)'}`);
      return;
    }

    pass('built CLI --version', printed);
  } catch (error) {
    warn('built CLI --version', error instanceof Error ? error.message : String(error));
  }
}

async function checkNpm(version) {
  try {
    const response = await fetch('https://registry.npmjs.org/@3notch%2Fcli/latest', {
      headers: { accept: 'application/json' },
    });
    if (!response.ok) {
      fail('npm registry', `HTTP ${response.status} fetching @3notch/cli latest`);
      return;
    }

    const latest = /** @type {{ version?: string }} */ (await response.json());
    const published = latest.version;
    if (!published) {
      fail('npm registry', 'latest version missing from registry response');
      return;
    }

    if (published === version) {
      pass('npm latest', published);
      return;
    }

    const detail = `registry ${published} !== package ${version}`;
    if (requirePublished) {
      fail('npm latest', `${detail}. Publish before marking the release done.`);
      return;
    }

    if (isOlderSemver(published, version)) {
      warn(
        'npm latest',
        `${detail}. Repo is ahead of npm — run the release runbook publish step.`,
      );
      return;
    }

    warn(
      'npm latest',
      `${detail}. Registry is ahead or diverged — investigate tags and package.json.`,
    );
  } catch (error) {
    fail('npm registry', error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  const packageState = await checkPackageSurfaces();
  if (packageState) {
    await checkChangelog(packageState.version);
    await checkSiteVersion(packageState.version);
    await checkBuiltCli(packageState.version);
    if (withNpm || requirePublished) {
      await checkNpm(packageState.version);
    }
  }

  const failed = results.filter((result) => result.level === 'fail');
  const warned = results.filter((result) => result.level === 'warn');

  for (const result of results) {
    const mark = result.level === 'pass' ? 'PASS' : result.level === 'warn' ? 'WARN' : 'FAIL';
    console.log(`${mark.padEnd(4)} ${result.label}: ${result.detail}`);
  }

  console.log('');
  console.log(
    `release-check: ${results.length - failed.length - warned.length} pass, ${warned.length} warn, ${failed.length} fail`,
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

await main();
