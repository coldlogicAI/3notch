# V5 Implementation Log

## 2026-08-04

- Activated the durable-inbox plan on isolated branch `agent/2026-08-04-durable-inbox` from upstream `a9006ca` after confirming PRs #1-#3 are merged.
- Reviewed the proposed CLI against current packet/import/MCP/store-lock behavior and corrected the missing transport-root contract.
- Kept V5 as a dependency-free local spool: explicit root, registered local address, deterministic delivery identity, sender-side preflight, hash-before-import, retained acknowledgements, vendor-neutral MCP schemas, and redacted local lifecycle audit events.
- Baseline lint, type-check, build, and 22 e2e tests passed. The current dependency lock reports 11 npm advisories; remediation will be tested separately from inbox behavior.
- Implemented the dependency-free local adapter and service: ignored config, safe local addresses, registered recipients, deterministic delivery IDs, atomic staging, recipient serialization, strict metadata schemas, retained states, hash-before-pull, pre-send/pre-import archive/schema/artifact/secret validation, private/seed blocking, decompression and size caps, and redacted lifecycle audit events.
- Added the CLI (`send`, `inbox init/list/pull/ack`) and five matching MCP tools with shared structured results, focused descriptions, output schemas, write/read annotations, and concise cross-model workflow instructions.
- Core verification passes: lint, type-check, and 16 focused adapter/service tests including 20 simultaneous sends, 10 simultaneous import pulls, retry idempotency, conflicting bytes, corruption/rejection, unsafe addresses, symlinks, malformed stores, secret/private blocking, archive bounds, retained ack history, and audit traces.
- Hardened the archive boundary for untrusted delivery: reject oversized files before reading, bound decompression and entry count, verify tar header checksums and numeric fields, and reject malformed padding, duplicate paths, unsafe entries, missing end markers, and trailing data.
- Refreshed the lockfile without forced major upgrades. The source graph and clean installed tarball both report zero npm advisories; a scoped `tsup` override keeps esbuild on the patched `0.28.1` line.
- Final verification passed after a clean `npm ci`: lint, type-check, build, 234 tests across 78 files, and 23 e2e tests across 11 files. The packed `@3notch/cli@0.6.0` tarball installed into an empty prefix and completed a real request → import → typed reply → import → ack loop with lineage preserved and both stores passing `notch check`.

## 2026-08-07

- Fixed PR review regressions in durable-inbox recovery and enumeration: receiver size-policy failures stay retryable, legacy size rejections clear after successful revalidation, terminal rejections cannot return false-success resend results, and unmanaged sync-folder clutter no longer blocks listing while malformed managed delivery entries still fail closed.
- Regression verification passed: lint, type-check, production build, 235 tests across 78 files, 23 e2e tests across 11 files, and the built CLI help smoke check.

## 2026-08-09

- **PR #9 (0.7.0):** delivery notices on `send` / `send_packet`; read-only `inbox status` / `get_inbox_delivery`; docs/prompt/schema/test updates. CI green; review nits fixed (status nextAction coverage, pending wording, notice only on send schemas).
- **PR #7 already on main as 0.6.0 surface** (durable inbox). npm registry lagged at 0.5.0 until catch-up publish.
- **npm publish lessons:** publish from intended checkout (`main` after pull); token temp-npmrc needs double-quoted `${NPM_TOKEN}`; write-2FA + security key means CLI OTP fails without TOTP or bypass-2FA granular token.
- **0.7.0 tarball** initially cut without StopFailure widen (#14) due to stale branch; corrected with **0.7.1**.
- Roadmap issues filed: #10 multi-machine recipes, #11 encryption, #12 authorship, #13 remote transport. #15 optional resume UX (structured offer / `notch resume`) — not blocking.
- Release runbook + `release:check` / `release:status` landed; CI lint needs Node globals for `scripts/**`.
