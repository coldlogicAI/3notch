# 3Notch V1 Implementation Log

Use this file during long-running `/goal` implementation sessions. Keep entries concise and append-only.

## Entry Template

```md
## YYYY-MM-DD HH:MM Local

- Goal slice:
- Plan steps covered:
- Files changed:
- Verification:
- Commit:
- Next step:
- Blockers or decisions:
```

## 2026-05-23 23:20 EDT

- Goal slice: Add reusable test harness helpers for CLI, temp projects, store fixtures, and in-memory MCP sessions.
- Plan steps covered: Wave 1, Step 1.4.
- Files changed: `tests/helpers/run-cli.ts`, `tests/helpers/temp-project.ts`, `tests/helpers/store-fixtures.ts`, `tests/helpers/mcp-harness.ts`, `tests/unit/helpers.test.ts`.
- Verification: `npm test -- helpers`; `npm run lint`; `npm run type-check`; `npm run build`; `npm test`; `node dist/cli/index.js --help`; `node dist/cli/index.js --version`.
- Commit: `5a53bfa`.
- Next step: Wave 2, Step 2.1 core record, error, and command types.
- Blockers or decisions: None.

## 2026-05-23 23:31 EDT

- Goal slice: Add Wave 2 typed record contracts, strict JSON schemas, Markdown/YAML parser, fixtures, templates, and canonical MCP tool input schemas.
- Plan steps covered: Wave 2, Steps 2.1 through 2.7.
- Files changed: `src/types/*`, `src/core/schema-service.ts`, `src/core/markdown-service.ts`, `src/core/record-parser.ts`, `src/schemas/*`, `src/templates/*`, `src/mcp/tool-schemas.ts`, `tests/schema/*`, `tests/unit/types.test.ts`, `tests/unit/record-parser.test.ts`, `tests/fixtures/*`.
- Verification: `npm test -- types base-schemas project-brief-schema targeted-brief-schema packet-schema record-parser status-schema mcp-tool-schemas`; `npm run lint`; `npm run type-check`; `npm run build`; `npm test`; `node dist/cli/index.js --help`; `node dist/cli/index.js --version`.
- Commit: `1c6d2ed`.
- Next step: Wave 3, Step 3.1 config/store discovery and CLI output helpers.
- Blockers or decisions: None.

## 2026-05-23 23:37 EDT

- Goal slice: Add Wave 3 store foundation: config discovery, path safety, actor/ID metadata, atomic record writes, audit log handling, secret scanning, and derived JSON index rebuilds.
- Plan steps covered: Wave 3, Steps 3.1 through 3.7.
- Files changed: `src/core/config-service.ts`, `src/core/store-layout.ts`, `src/cli/output.ts`, `src/core/path-safety.ts`, `src/core/id-service.ts`, `src/core/actor-service.ts`, `src/core/record-factory.ts`, `src/core/store-service.ts`, `src/core/audit-service.ts`, `src/core/secret-scan-service.ts`, `src/core/index-service.ts`, Wave 3 unit tests and fixtures.
- Verification: `npm test -- config-service path-safety record-factory store-service audit-service secret-scan-service index-service`; `npm run lint`; `npm run type-check`; `npm run build`; `npm test`; `node dist/cli/index.js --help`; `node dist/cli/index.js --version`.
- Commit: `c2b056c`.
- Next step: Wave 4, Step 4.1 brief service.
- Blockers or decisions: None.

## 2026-05-23 23:47 EDT

- Goal slice: Add Wave 4 service layer for project/targeted briefs, packet creation/list/read, transfer imports, private seed packets, status summaries, and doctor checks.
- Plan steps covered: Wave 4, Steps 4.1 through 4.3.
- Files changed: `src/core/brief-service.ts`, `src/core/packet-service.ts`, `src/core/transfer-service.ts`, `src/core/seed-service.ts`, `src/core/status-service.ts`, `src/core/doctor-service.ts`, `src/core/store-service.ts`, `src/core/record-parser.ts`, `src/core/secret-scan-service.ts`, Wave 4 unit tests.
- Verification: `npm test -- brief-service packet-service transfer-service seed-service status-service doctor-service secret-scan-service`; `npm test -- packet-schema record-parser seed-service packet-service transfer-service status-service doctor-service`; `npm run lint`; `npm run type-check`; `npm run build`; `npm test`; `node dist/cli/index.js --help`; `node dist/cli/index.js --version`.
- Commit: `60ad930`.
- Next step: Wave 5, Step 5.1 global CLI runtime plumbing.
- Blockers or decisions: None.

## 2026-05-23 23:51 EDT

- Goal slice: Add global CLI context/error plumbing, `notch onboard`, MCP setup instructions, and an initial `notch status` adapter for store-load/error coverage.
- Plan steps covered: Wave 5, Steps 5.1 and 5.2, plus a narrow part of Step 5.5 for `status`.
- Files changed: `src/cli/context.ts`, `src/cli/errors.ts`, `src/cli/formatters.ts`, `src/cli/mcp-instructions.ts`, `src/cli/commands/onboard.ts`, `src/cli/commands/status.ts`, `src/cli/program.ts`, `src/cli/index.ts`, CLI tests and `.notch/.gitignore` fixture.
- Verification: `npm test -- help global-flags onboard status-service`; `npm run lint`; `npm run type-check`; `npm run build`; `npm test`; `node dist/cli/index.js --help`; `node dist/cli/index.js --version`.
- Commit: `d69044c`.
- Next step: Wave 5, Step 5.3 `notch brief` command family.
- Blockers or decisions: None.

## 2026-05-23 23:55 EDT

- Goal slice: Complete Wave 5 CLI command families for briefs, packets, private seeds, status, and doctor.
- Plan steps covered: Wave 5, Steps 5.3 through 5.5.
- Files changed: `src/cli/commands/brief.ts`, `src/cli/commands/packet.ts`, `src/cli/commands/seed.ts`, `src/cli/commands/doctor.ts`, `src/cli/program.ts`, `src/core/brief-service.ts`, `src/core/packet-service.ts`, CLI tests for brief, targeted brief, packet, seed, status, and doctor.
- Verification: `npm test -- brief targeted-brief brief-service`; `npm test -- packet seed packet-service transfer-service seed-service`; `npm test -- brief targeted-brief packet seed status doctor global-flags onboard help`; `npm run lint`; `npm run type-check`; `npm run build`; `npm test`; `node dist/cli/index.js --help`; `node dist/cli/index.js --version`.
- Commit: `3524a7a`.
- Next step: Wave 6, Step 6.1 stdio MCP server foundation.
- Blockers or decisions: None.

## 2026-05-24 00:01 EDT

- Goal slice: Add local MCP server, `notch mcp serve`, all V1 MCP tools, read-only enforcement, and private packet read gating.
- Plan steps covered: Wave 6, Steps 6.1 through 6.4.
- Files changed: `src/mcp/server.ts`, `src/mcp/errors.ts`, `src/cli/commands/mcp.ts`, `src/cli/program.ts`, `src/core/doctor-service.ts`, `src/core/brief-service.ts`, `src/core/packet-service.ts`, MCP tests for startup, brief tools, packet tools, status/doctor tools, and read-only mode.
- Verification: `npm test -- server-start brief-tools packet-tools status-doctor-tools read-only-mode doctor-service doctor`; `npm test`; `npm run lint`; `npm run type-check`; `npm run build`; `node dist/cli/index.js --help`; `node dist/cli/index.js --version`.
- Commit: `a7a62b8`.
- Next step: Wave 7 hardening, fixtures, docs, CI, telemetry/deferred-surface guards.
- Blockers or decisions: None.

## 2026-05-24 00:24 EDT

- Goal slice: Complete Wave 7 hardening, demo fixtures, workflow docs, prompt docs, CI matrix, telemetry/deferred-surface guards, and final e2e smoke coverage.
- Plan steps covered: Wave 7, Steps 7.1 through 7.5; Final Step 8.1.
- Files changed: `.github/workflows/ci.yml`, `README.md`, `package.json`, `src/core/{brief-service,config-service,doctor-service,packet-service,secret-scan-service,seed-service,transfer-service}.ts`, Wave 7 CLI/e2e/unit tests, `fixtures/*`, `docs/{cross-repo-packets,cross-tool-handoff,mcp-setup,privacy,private-context-seeding,targeted-brief-workflow}.md`, `docs/prompts/*`.
- Verification: `npm test -- no-telemetry-deps no-deferred-commands cross-repo-packet-smoke private-context-seed-smoke cross-tool-handoff-smoke local-privacy secret-scan-service`; `npm test -- corrupt-store path-traversal audit-integration secret-scan cross-store-destination secret-scan-service doctor-service`; `npm run lint`; `npm run type-check`; `npm run build`; `npm test`; `npm run test:e2e`; `node dist/cli/index.js --help`; `node dist/cli/index.js --version`; README fresh-clone quickstart smoke; fixture `doctor --fix --yes`; fixture inbox list; private seed git-ignore check.
- Commit: `693ff79`.
- Next step: Stage and commit this coherent slice, then run final acceptance audit against the spec and plan.
- Blockers or decisions: Corrected store discovery to prefer a nested `.notch/config.json` before an outer Git root so documented fixture and nested-project commands work. Removed the extra private seed output copy and allowed doctor to treat packet inbox/outbox transfer pairs as one packet identity while still detecting true duplicate source records. Confirmed npm package `send` is only a transitive Express dependency through the MCP SDK, not a 3Notch command surface.

## 2026-05-24 00:28 EDT

- Goal slice: Tighten telemetry-denylist coverage during final acceptance audit.
- Plan steps covered: Wave 7, Step 7.5.
- Files changed: `tests/unit/no-telemetry-deps.test.ts`.
- Verification: `npm test -- no-telemetry-deps`.
- Commit: pending.
- Next step: Commit the audit hardening and complete final acceptance verification.
- Blockers or decisions: The lockfile contains an optional Vitest peer reference to `@opentelemetry/api`, but `npm ls @opentelemetry/api` proves it is not installed. The guard checks installed lockfile package keys rather than raw optional peer text.
