# Release Runbook

How to ship a 3Notch version without drifting `package.json`, npm, the site, or the changelog.

**Always run `npm run release:status` before and after cutting.** That command compares `package.json` to the live npm `latest` tag and warns when the registry lags.

## Surfaces That Must Stay Aligned

| Surface | How it is set |
| --- | --- |
| `package.json` `version` | Source of truth for the CLI version |
| `package-lock.json` root version | Must match `package.json` (npm updates both on `npm version`) |
| `src/core/version.ts` | Imports `package.json` — no separate bump |
| `CHANGELOG.md` | Must have `## [x.y.z] - YYYY-MM-DD` for the release |
| `site/public/index.html` `softwareVersion` | Marketing JSON-LD; must match package version |
| npm `@3notch/cli` | Explicit maintainer publish (see below) |
| GitHub Release / tag `vX.Y.Z` | Optional but recommended; matches package version |

README npm badges use live npm data — they do not need a manual version edit.

## When To Bump

| Change | Bump |
| --- | --- |
| Bug fix, docs, release tooling | patch (`0.7.0` → `0.7.1`) if you publish; or ship on the next minor if still unreleased |
| New user-visible command/tool/behavior | minor (`0.7.x` → `0.8.0`) |
| Breaking CLI/MCP/schema contract | major (pre-1.0: still use minor carefully and call it out) |

Feature work can land on `main` under `## [Unreleased]` without publishing every PR. **Do not** leave multiple shipped minors on `main` without a corresponding npm publish the same day (or a tracking issue).

## Pre-Release Checklist

```bash
# 1. Working tree clean on main (or release branch)
git status

# 2. Full verification (same as CI)
npm ci
npm run lint
npm run type-check
npm run build
npm test
npm run test:e2e
node dist/cli/index.js --help
node dist/cli/index.js --version

# 3. Internal version surfaces + npm lag report
npm run release:check          # fail on package/lock/changelog/site/CLI drift
npm run release:status         # same + npm registry warn if lagging
```

Manual review:

- [ ] `CHANGELOG.md`: move `Unreleased` notes into `## [x.y.z] - YYYY-MM-DD`
- [ ] User-facing docs still match the shipped surface (`docs/guides/`, README command lists)
- [ ] No deferred verbs reintroduced (`tests/unit/no-deferred-commands.test.ts`)
- [ ] `site/public/index.html` `softwareVersion` matches (release-check enforces this)

## Version Bump Commands

Prefer npm’s version tooling so lockfile stays in sync:

```bash
# after editing CHANGELOG + site softwareVersion
npm version patch   # or minor / major
# edits package.json + package-lock.json and creates a git commit + tag by default
```

If you already bumped manually:

```bash
npm install --package-lock-only
npm run release:check
```

Update site JSON-LD in the same commit as the version bump:

```html
"softwareVersion": "x.y.z",
```

## Auth Reality (read this before publish)

`npm login` alone is often **not** enough to publish.

- The `coldlogicai` account uses **write 2FA** (security key / passkey such as Touch ID).
- CLI `npm publish` may demand a **TOTP one-time password** (`EOTP`). A security key is not a 6-digit authenticator code.
- npm is deprecating long-lived **bypass-2FA** tokens for account management and (later) direct publish. Prefer short-lived granular tokens for manual release; plan **Trusted Publishing (OIDC)** for CI.

| Method | When to use |
| --- | --- |
| **Granular token + temp config** (below) | Recommended manual publish today |
| **`npm publish --otp=…`** | Only after a TOTP authenticator (e.g. 1Password) is enrolled on the npm 2FA page |
| **Plain `npm publish`** | Works only if auth already satisfies write 2FA (token or interactive path) |

Never commit tokens. Never put tokens in project `.npmrc` that might be committed.

## Manual Publish To npm (proven recipe)

### 1. Create a granular access token (website)

1. [npm Access Tokens](https://www.npmjs.com/settings/coldlogicai/tokens) → **Generate New Token** → **Granular Access Token**
2. Suggested name: `3notch-cli-publish-mac-YYYY-MM` (or `…-once-x.y.z` for a single release)
3. **Packages:** only `@3notch/cli` (read and write)
4. **Bypass two-factor authentication:** enabled (required for non-interactive publish with write-2FA)
5. **IP range:** leave empty unless you intentionally lock to your current public IP (`x.x.x.x/32`). Home IPs change; empty is fine for a short-lived token
6. Expiration: short (e.g. 90 days) or until end of release day for one-shot tokens
7. Store the token in **1Password** immediately; you only see it once

Optional second token name for CI later: `3notch-cli-publish-gha` (no IP lock; store only in GitHub Secrets as `NPM_TOKEN`).

### 2. Publish without writing secrets into the repo

From the project root, with `package.json` already at the release version:

```bash
# Publish from the tree you intend to ship (usually up-to-date main)
git checkout main && git pull
node -p "require('./package.json').version"   # confirm expected version

npm run build
npm run release:check

# Paste token from 1Password when prompted (hidden input)
read -rs "NPM_TOKEN?Paste npm token from 1Password: "
echo
export NPM_TOKEN
test -n "$NPM_TOKEN" || { echo "empty token"; exit 1; }

npm_cfg="$(mktemp)"
chmod 600 "$npm_cfg"
# Double quotes required so ${NPM_TOKEN} expands (single quotes write the literal text)
printf '%s\n' "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > "$npm_cfg"
export NPM_CONFIG_USERCONFIG="$npm_cfg"
trap 'rm -f -- "$npm_cfg"; unset NPM_TOKEN' EXIT

npm whoami
npm publish --access public
npm view @3notch/cli version
npm run release:status -- --require-published
```

What this does:

- Publishes the current checkout (not whatever happens to be on GitHub unless you pulled)
- Keeps the token out of the project tree and out of a permanent project `.npmrc`
- Uses a mode-`600` temp npm userconfig and deletes it on shell exit
- Confirms identity before publish; fails status check until registry `latest` equals `package.json`

Dry-run (no registry write):

```bash
# same temp-config setup as above, then:
npm publish --access public --dry-run
```

### 3. Alternate: OTP after authenticator enrollment

If you add a TOTP authenticator on npm’s 2FA page (1Password can store the OTP):

```bash
npm run build
npm run release:check
npm publish --access public --otp=123456   # fresh code, ~30s window
npm run release:status -- --require-published
```

Security-key-only accounts without TOTP cannot satisfy `--otp=`.

## GitHub Tag And Release

```bash
# if npm version did not create the tag
git tag -a "vX.Y.Z" -m "vX.Y.Z"
git push origin main --tags

gh release create "vX.Y.Z" --title "vX.Y.Z" --notes-file - <<'EOF'
See CHANGELOG.md for details.
EOF
```

CI runs on `main` and pull requests. Tag push does **not** publish to npm automatically yet.

## After Publish

```bash
npm view @3notch/cli version
npm install -g @3notch/cli@latest
notch --version
npm run release:status -- --require-published
```

- [ ] npm latest matches repo
- [ ] Global install reports the new version
- [ ] GitHub Release published (if used)
- [ ] Revoke one-shot tokens on the npm tokens page when finished
- [ ] Optional: store a separate GHA token in GitHub secret `NPM_TOKEN` (never in git)

## Catch-Up Publish (Repo Ahead Of npm)

If `main` already contains a newer version than registry `latest`:

1. Confirm `package.json` is the version you intend to publish
2. Ensure `CHANGELOG.md` has that version section and site `softwareVersion` matches
3. Use the **Manual Publish** recipe above (token + temp config)
4. `npm run release:status -- --require-published`

You do not need to publish every intermediate tag if they never left the monorepo; publishing the current `package.json` version is enough for `@latest`.

## Automation (today vs next)

| Command / path | Purpose |
| --- | --- |
| `npm run release:check` | Fail on internal drift (package, lock, changelog, site, built CLI) |
| `npm run release:status` | Same + npm registry comparison (warn if lagging) |
| `npm run release:status -- --require-published` | Fail if npm `latest` ≠ package version |
| CI `release-check` step | Runs `release:check` on every PR and main push |
| Manual token publish | Current maintainer path (this runbook) |
| Trusted Publishing (OIDC) | Preferred future CI path — no long-lived bypass-2FA token |

npm is restricting granular tokens that bypass 2FA for sensitive account actions and, over time, for direct publish. Do not design new permanent automation solely on bypass-2FA tokens; migrate CI to **Trusted Publishing** when ready.

The version unit test still asserts `VERSION` matches `package.json`. `release-check` is the broader surface gate.

## Agent / Maintainer Notes

When finishing a version-shaped PR:

1. Prefer one release PR (or the last PR in a series) that owns version + changelog + site + publish notes.
2. Do not bump version on every small fix PR if you are not publishing.
3. After merge of a version bump, **publish the same day** using the manual recipe, or leave a tracking issue “publish x.y.z to npm”.
4. Agents must not invent or commit npm tokens. Maintainers paste tokens from 1Password into the temp-config flow only.
