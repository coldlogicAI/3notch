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
