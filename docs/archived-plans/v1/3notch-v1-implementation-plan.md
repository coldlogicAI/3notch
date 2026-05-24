## Implementation Plan: 3Notch V1 MVP

### Scope

V1 ships exactly three loops:

1. **Packet transfer.** `notch packet create`, `notch packet import`, `notch packet list`, `notch packet show`. Plus MCP: `create_packet`, `import_packet`, `list_packets`, `get_packet`.
2. **Private context seeding.** `notch seed from <repo-or-store-path>`. Plus MCP: `create_seed_packet`, `import_seed_packet`.
3. **Targeted briefs.** `notch brief`, `notch brief create`, `notch brief list`, `notch brief show`. Plus MCP: `get_brief`, `create_brief`, `list_briefs`, `get_targeted_brief`.

Supporting commands: `notch onboard`, `notch status`, `notch doctor`, `notch mcp serve`. Supporting MCP tools: `get_status`, `run_doctor`.

V1 does not implement `notch pass`, `notch send`, `notch decision *`, `notch question *`, `notch conflict *`, or `notch stale *`. Their MCP equivalents are also absent. The product principle is cross-boundary portability; same-repo same-session continuity is left to CLAUDE.md, native tool memory, and git.

### Assumptions

- The repo currently has a bootstrap CLI (`notch --help`, `notch --version`), test harness scaffolding, and OSS files. Implementation continues from there.
- `3notch-v1-technical-spec.md` is authoritative.
- Cross-repo packet transfer is the minimum proof: repo A creates a packet, repo B imports it, CLI/MCP can read the imported packet.
- Private context seeding minimum proof: an old repo/store seeds a new repo's ignored `.notch/private/inbox/`, and MCP hides that seed unless explicitly started with `--include-private`.
- Cross-tool handoff minimum proof: an MCP caller can create/read packets from explicitly supplied context without hidden chat/project scraping.
- Claude Desktop DXT packaging and remote MCP connectors are future layers; V1 builds the local CLI plus local MCP server they would wrap.
- The package uses Node.js 20+, TypeScript, Commander, Ajv, Vitest, tsup, and `@modelcontextprotocol/sdk`.

### Wave 1: Foundation (mostly done, finish what's open)

- [x] **Step 1.1: npm package manifest** — `package.json`, `package-lock.json`.
- [x] **Step 1.2: TypeScript/build/lint/test config** — `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `.gitignore`.
- [x] **Step 1.3: CLI entry skeleton** — `src/cli/index.ts`, `src/cli/program.ts`, `src/core/version.ts`, `tests/cli/help.test.ts`. (Note: `src/cli/output.ts` deferred to Step 3.1; help text already lists V1 commands minus deferred ones.)
- [ ] **Step 1.4: Test harness helpers**
  - **Files:**
    - `tests/helpers/run-cli.ts` - NEW
    - `tests/helpers/temp-project.ts` - NEW
    - `tests/helpers/store-fixtures.ts` - NEW
    - `tests/helpers/mcp-harness.ts` - NEW
  - **Implementation:** isolated temp directories with optional Git init; helpers for invoking built or tsx-powered CLI with stdout/stderr/exit code capture; in-memory MCP transport setup using `@modelcontextprotocol/sdk`.
  - **Dependencies:** Step 1.3.
  - **Verification:** `npm test -- helpers` exercises temp project creation/cleanup and a no-op MCP harness round-trip.

### Wave 2: Schemas and Record Parsing

- [ ] **Step 2.1: Core record and error types**
  - **Files:**
    - `src/types/records.ts` - NEW
    - `src/types/errors.ts` - NEW
    - `src/types/commands.ts` - NEW
    - `tests/unit/types.test.ts` - NEW
  - **Implementation:** encode `RecordMeta`, `ProjectBrief`, `NotchBrief`, `NotchPacket`, `PacketRecordRef`, `AuditEntry`, `NotchError`, plus actor/source-tool/source-link/sensitivity/purpose unions. Keep MCP and CLI transport concerns out.
  - **Dependencies:** Step 1.2.
  - **Verification:** `npm test -- types`.

- [ ] **Step 2.2: Shared, config, and audit schemas**
  - **Files:**
    - `src/schemas/shared.schema.json` - NEW
    - `src/schemas/config.schema.json` - NEW
    - `src/schemas/audit.schema.json` - NEW
    - `src/core/schema-service.ts` - NEW
    - `tests/schema/base-schemas.test.ts` - NEW
  - **Implementation:** Ajv strict mode; shared definitions for actor, source tool, source link, tags, semver-validated schema version; audit entries with `actorNameResolution` and `actorTypeResolution`; return normalized `NotchError` objects.
  - **Dependencies:** Step 2.1.
  - **Verification:** `npm test -- base-schemas`.

- [ ] **Step 2.3: Project brief schema and fixtures**
  - **Files:**
    - `src/schemas/project-brief.schema.json` - NEW
    - `src/templates/project-brief.md` - NEW
    - `tests/fixtures/valid-project-brief.md` - NEW
    - `tests/fixtures/invalid-project-brief-missing-heading.md` - NEW
    - `tests/schema/project-brief-schema.test.ts` - NEW
  - **Implementation:** require frontmatter metadata and body headings: `## Current Focus`, `## Active Constraints`, `## Recent Activity`, `## Open Threads`, `## Warnings`.
  - **Dependencies:** Step 2.2.
  - **Verification:** `npm test -- project-brief-schema`.

- [ ] **Step 2.4: Targeted brief schema and fixtures**
  - **Files:**
    - `src/schemas/brief.schema.json` - NEW
    - `src/templates/targeted-brief.md` - NEW
    - `tests/fixtures/valid-targeted-brief.md` - NEW
    - `tests/fixtures/invalid-targeted-brief-missing-goal.md` - NEW
    - `tests/schema/targeted-brief-schema.test.ts` - NEW
  - **Implementation:** require `targetAgent`, `goal`, `scope`, `exclusions`, `designBasis`, `priorReasoningSummary`, and required body sections. Empty exclusions allowed only when explicitly stored as `[]`.
  - **Dependencies:** Step 2.2.
  - **Verification:** `npm test -- targeted-brief-schema`.

- [ ] **Step 2.5: Packet schema and fixtures**
  - **Files:**
    - `src/schemas/packet.schema.json` - NEW
    - `src/templates/packet.md` - NEW
    - `tests/fixtures/valid-packet.md` - NEW
    - `tests/fixtures/valid-seed-packet.md` - NEW
    - `tests/fixtures/invalid-packet-missing-origin.md` - NEW
    - `tests/schema/packet-schema.test.ts` - NEW
  - **Implementation:** require origin repo metadata, recipient metadata (for `purpose: handoff` at least one of `targetAgent`/`targetPerson`/`targetRepo`), summary, included record refs, purpose, sensitivity, transferStatus, required body sections. Support seed packets with `purpose: seed`, `sensitivity: private`, and user/workflow context sections. Allow origin file/source links to point at the source repo while keeping destination import paths separately validated. Validate `recordType: packet` and quoted semver-compatible `schemaVersion`.
  - **Dependencies:** Step 2.2.
  - **Verification:** `npm test -- packet-schema`.

- [ ] **Step 2.6: Markdown/YAML record parser**
  - **Files:**
    - `src/core/markdown-service.ts` - NEW
    - `src/core/record-parser.ts` - NEW
    - `tests/unit/record-parser.test.ts` - NEW
    - `tests/fixtures/bad-yaml.md` - NEW
    - `tests/fixtures/missing-required-heading.md` - NEW
  - **Implementation:** parse YAML frontmatter via `gray-matter` or `yaml`. Coerce scalar `schemaVersion` values to strings. Return parsed metadata, Markdown body, and structured errors without throwing raw parser errors.
  - **Dependencies:** Steps 2.2 through 2.5.
  - **Verification:** `npm test -- record-parser`; bad YAML returns `NOTCH_CORRUPT_RECORD`, missing headings return `NOTCH_RECORD_INVALID`.

- [ ] **Step 2.7: Status and MCP input schemas**
  - **Files:**
    - `src/schemas/status.schema.json` - NEW
    - `src/schemas/mcp-tools.schema.json` - NEW
    - `src/mcp/tool-schemas.ts` - NEW
    - `tests/schema/status-schema.test.ts` - NEW
    - `tests/schema/mcp-tool-schemas.test.ts` - NEW
  - **Implementation:** treat `src/schemas/mcp-tools.schema.json` as the canonical MCP input-schema source. `src/mcp/tool-schemas.ts` loads/exports schemas from the packaged JSON. Define input schemas for every V1 MCP tool: `get_brief`, `create_brief`, `list_briefs`, `get_targeted_brief`, `create_packet`, `import_packet`, `list_packets`, `get_packet`, `create_seed_packet`, `import_seed_packet`, `get_status`, `run_doctor`. Enforce `list_packets` limit `1..50` and other enum constraints.
  - **Dependencies:** Step 2.2.
  - **Verification:** `npm test -- mcp-tool-schemas status-schema`.

### Wave 3: Store, Path Safety, Audit, Index

- [ ] **Step 3.1: Config and store discovery, CLI output helpers**
  - **Files:**
    - `src/core/config-service.ts` - NEW
    - `src/core/store-layout.ts` - NEW
    - `src/cli/output.ts` - NEW
    - `tests/unit/config-service.test.ts` - NEW
    - `tests/fixtures/config-valid.json` - NEW
    - `tests/fixtures/config-invalid.json` - NEW
  - **Implementation:** support `--cwd` and `--store`, default `.notch/`, Git-root detection. Create and validate source folders: `briefs/`, `inbox/`, `outbox/`, `private/inbox/`, `private/outbox/`. Validate config with `config.schema.json` and warn on unknown top-level fields. Build `output.ts` for JSON/quiet/color-controlled CLI emission.
  - **Dependencies:** Steps 2.2, 2.6.
  - **Verification:** `npm test -- config-service`; missing store maps to exit code `2`.

- [ ] **Step 3.2: Path safety and symlink rejection**
  - **Files:**
    - `src/core/path-safety.ts` - NEW
    - `tests/unit/path-safety.test.ts` - NEW
  - **Implementation:** reject absolute paths, `~`, sibling traversal, paths resolving outside `config.project.root`, and symlinks inside `.notch/`. Provide separate helpers for origin source links inside imported packets vs local destination write paths, so imported packets preserve source repo references without allowing unsafe writes.
  - **Dependencies:** Step 3.1.
  - **Verification:** `npm test -- path-safety`; traversal fails with `NOTCH_PATH_OUTSIDE_PROJECT`; backslash separators normalize safely; drive-letter absolute paths rejected; symlinks rejected.

- [ ] **Step 3.3: ID, actor, and metadata factory**
  - **Files:**
    - `src/core/id-service.ts` - NEW
    - `src/core/actor-service.ts` - NEW
    - `src/core/record-factory.ts` - NEW
    - `tests/unit/record-factory.test.ts` - NEW
  - **Implementation:** generate deterministic IDs, slugs, filenames, actor metadata, source tool metadata. Resolve actor display name from `--actor`/`--agent` flags, Git config, environment, or unknown; track display-name resolution separately from type resolution. Default CLI writes human/reviewed; MCP writes agent/unreviewed.
  - **Dependencies:** Step 2.1.
  - **Verification:** `npm test -- record-factory`; generated records include actor, timestamp, source tool, record type, and schema version.

- [ ] **Step 3.4: Atomic store read/write and file scanning**
  - **Files:**
    - `src/core/store-service.ts` - NEW
    - `tests/unit/store-service.test.ts` - NEW
  - **Implementation:** write to temp files and rename. Scan only allowed `.notch/` source directories, including `inbox/`, `outbox/`, and `private/` when explicitly requested. Ignore invalid records unless `doctor` requests them.
  - **Dependencies:** Steps 3.1, 3.2, 2.6.
  - **Verification:** `npm test -- store-service`; explicit slug collisions fail while auto-generated collisions suffix safely with `-2`, `-3`.

- [ ] **Step 3.5: Audit logging**
  - **Files:**
    - `src/core/audit-service.ts` - NEW
    - `tests/unit/audit-service.test.ts` - NEW
    - `tests/fixtures/audit-corrupt.jsonl` - NEW
  - **Implementation:** append-only `.notch/logs/audit.jsonl` entries matching `audit.schema.json`. Surface `NOTCH_AUDIT_WRITE_FAILED` when record write succeeds but audit append fails. Audit retains the full source path for `importedFrom` operations even when the stored record uses only the basename.
  - **Dependencies:** Steps 2.2, 3.3, 3.4.
  - **Verification:** `npm test -- audit-service`; every successful write fixture produces exactly one valid audit line.

- [ ] **Step 3.6: Secret scanning**
  - **Files:**
    - `src/core/secret-scan-service.ts` - NEW
    - `tests/unit/secret-scan-service.test.ts` - NEW
  - **Implementation:** detect configured regex patterns, JWTs, SSH private keys, and token-like 32+ character strings. Emit `NOTCH_SECRET_DETECTED` and write a `secret-blocked` audit entry without creating the source record.
  - **Dependencies:** Steps 3.1, 3.5.
  - **Verification:** `npm test -- secret-scan-service`; blocked writes do not create source records and append one `secret-blocked` audit entry.

- [ ] **Step 3.7: Derived JSON index**
  - **Files:**
    - `src/core/index-service.ts` - NEW
    - `src/types/index.ts` - NEW
    - `tests/unit/index-service.test.ts` - NEW
  - **Implementation:** build regenerable `.notch/index/records.json` and `.notch/index/manifest.json` from source files. Index record IDs, slugs, record types, status, tags, target agents, timestamps, packet origin/recipient, and paths. Treat index files as derived state.
  - **Dependencies:** Steps 3.4, 3.5.
  - **Verification:** `npm test -- index-service`; deleting `index/` and rebuilding reproduces the same manifest.

### Wave 4: Brief, Packet, Seed, Status, Doctor Services

- [ ] **Step 4.1: Brief service**
  - **Files:**
    - `src/core/brief-service.ts` - NEW
    - `tests/unit/brief-service.test.ts` - NEW
  - **Implementation:** read default `.notch/brief.md`. Create/list/get targeted briefs. Validate paths, scan secrets, validate schemas, write records, append audit, update index.
  - **Dependencies:** Steps 3.2, 3.3, 3.4, 3.5, 3.6, 3.7.
  - **Verification:** `npm test -- brief-service`; created records validate and have exactly one audit event.

- [ ] **Step 4.2: Packet, transfer, and seed services**
  - **Files:**
    - `src/core/packet-service.ts` - NEW
    - `src/core/transfer-service.ts` - NEW
    - `src/core/seed-service.ts` - NEW
    - `tests/unit/packet-service.test.ts` - NEW
    - `tests/unit/transfer-service.test.ts` - NEW
    - `tests/unit/seed-service.test.ts` - NEW
    - `tests/fixtures/packet-source-store/` - NEW
    - `tests/fixtures/packet-destination-store/` - NEW
  - **Implementation:**
    - Packet service: create packet Markdown/YAML from selected briefs, source links, and supplied body content. Project packets write to `.notch/outbox/`; private packets write to `.notch/private/outbox/`. Optional `--out` writes a portable standalone file. List inbox/outbox, get by ID/slug.
    - Transfer service: import validates a packet, writes only to `.notch/inbox/` (or `.notch/private/inbox/` for private packets), preserves origin metadata, sanitizes `importedFrom` to source basename, and avoids silent merge/overwrite. Cross-store destination check requires the destination to contain a `.notch/config.json` or be the root of a Git repo containing one; otherwise rejects with `NOTCH_STORE_NOT_FOUND`.
    - Seed service: create seed packets with `purpose: seed` and `sensitivity: private` under `.notch/private/`. `notch seed from` reads prior `.notch/` plus explicit files and requires review. Non-interactive runs without `--review` are rejected with `NOTCH_SEED_REVIEW_REQUIRED`.
  - **Dependencies:** Steps 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1.
  - **Verification:** `npm test -- packet-service transfer-service seed-service`; repo A outbox packets import into repo B inbox; old repo seed packets import into new repo private inbox; no import silently merges source records; destination without `.notch/config.json` is rejected; `importedFrom` stores basename only.

- [ ] **Step 4.3: Status and doctor services**
  - **Files:**
    - `src/core/status-service.ts` - NEW
    - `src/core/doctor-service.ts` - NEW
    - `tests/unit/status-service.test.ts` - NEW
    - `tests/unit/doctor-service.test.ts` - NEW
    - `tests/fixtures/corrupt-store.md` - NEW
  - **Implementation:**
    - Status reports counts (targeted briefs, inbox packets, outbox packets, private seed packets, validation issues), recent inbox packets, open briefs, warnings.
    - Doctor validates store structure, brief/packet/seed schemas, IDs, source links, audit log, symlinks, secrets, MCP write config, and `.notch/.gitignore` (must include `index/`, `logs/`, `private/`). Warns on broken origin references in imported packets without treating origin paths as destination path traversal.
  - **Dependencies:** Steps 3.1 through 4.2.
  - **Verification:** `npm test -- status-service doctor-service`; corrupt YAML reported as corruption; `doctor --fix` rebuilds only derived state.

### Wave 5: CLI Commands

- [ ] **Step 5.1: Global CLI runtime plumbing**
  - **Files:**
    - `src/cli/context.ts` - NEW
    - `src/cli/errors.ts` - NEW
    - `src/cli/formatters.ts` - NEW
    - `src/cli/program.ts` - MODIFIED
    - `tests/cli/global-flags.test.ts` - NEW
  - **Implementation:** wire global flags (`--cwd`, `--store`, `--json`, `--quiet`, `--no-color`, `--actor`, `--agent`, `--source-tool`). Map `NotchError.exitCode` to documented CLI exit codes. `--json` is machine-readable; `--quiet` suppresses non-error text.
  - **Dependencies:** Steps 1.3, 3.1, 3.3.
  - **Verification:** `npm test -- global-flags`; invalid store emits JSON error with exit code `2`.

- [ ] **Step 5.2: `notch onboard`**
  - **Files:**
    - `src/cli/commands/onboard.ts` - NEW
    - `src/cli/mcp-instructions.ts` - NEW
    - `src/cli/program.ts` - MODIFIED
    - `tests/cli/onboard.test.ts` - NEW
    - `tests/fixtures/notch-gitignore.txt` - NEW
  - **Implementation:** support `--name`, `--yes`, `--mcp`, `--force`, `--json`. Mutate known Claude Desktop/Cursor MCP config files only after explicit confirmation, using injectable config-home paths for tests. Print copy-pasteable MCP configuration instructions when a client path is unsupported or mutation is not confirmed. Never overwrite existing source records silently; only repair missing starter files with `--force`. Always create `.notch/.gitignore` containing `index/`, `logs/`, `private/`.
  - **Dependencies:** Steps 3.1, 3.4, 3.5, 5.1.
  - **Verification:** `npm test -- onboard`; `--yes` creates healthy store; `--mcp claude-desktop` mutates only an injected temp config path or prints fallback instructions.

- [ ] **Step 5.3: `notch brief` family**
  - **Files:**
    - `src/cli/commands/brief.ts` - NEW
    - `src/cli/formatters/brief-formatters.ts` - NEW
    - `src/cli/program.ts` - MODIFIED
    - `tests/cli/brief.test.ts` - NEW
    - `tests/cli/targeted-brief.test.ts` - NEW
  - **Implementation:** `notch brief`, `notch brief create`, `notch brief list`, `notch brief show <id>`. Interactive prompts, `--stdin`, `--editor`, filters, JSON output, slug collision rules, path validation.
  - **Dependencies:** Steps 4.1, 5.1.
  - **Verification:** `npm test -- brief targeted-brief`; create/list/show work by ID and slug; invalid paths exit `5`.

- [ ] **Step 5.4: `notch packet` family and `notch seed`**
  - **Files:**
    - `src/cli/commands/packet.ts` - NEW
    - `src/cli/commands/seed.ts` - NEW
    - `src/cli/formatters/packet-formatters.ts` - NEW
    - `src/cli/program.ts` - MODIFIED
    - `tests/cli/packet.test.ts` - NEW
    - `tests/cli/seed.test.ts` - NEW
  - **Implementation:**
    - `notch packet create`, `notch packet import <file>`, `notch packet list`, `notch packet show <id>`.
    - `notch seed from <repo-or-store-path>`.
    - Support selected record/file includes, JSON output, editor/stdin input, collision handling, local repo/store destination resolution, and file-path destinations. Seed imports default to `.notch/private/inbox/` and require review.
    - Targeting metadata (`--to-agent`, `--to-person`, `--to-repo`) routes context but does not imply secrecy or access control in V1.
  - **Dependencies:** Steps 4.2, 5.1.
  - **Verification:** `npm test -- packet seed`; two temp repos prove source outbox creation, destination inbox import, seed import into private inbox, list/show, and no silent merge into destination source records; non-interactive seed without `--review` is rejected.

- [ ] **Step 5.5: `notch status` and `notch doctor`**
  - **Files:**
    - `src/cli/commands/status.ts` - NEW
    - `src/cli/commands/doctor.ts` - NEW
    - `src/cli/program.ts` - MODIFIED
    - `tests/cli/status.test.ts` - NEW
    - `tests/cli/doctor.test.ts` - NEW
  - **Implementation:** `--json`, `doctor --fix`, `--yes`, `--strict`. `doctor --fix` rebuilds only derived state and missing derived folders.
  - **Dependencies:** Steps 4.3, 5.1.
  - **Verification:** `npm test -- status doctor`; strict warnings exit `6`; fresh stores report healthy.

### Wave 6: MCP Server

- [ ] **Step 6.1: Stdio MCP server foundation**
  - **Files:**
    - `src/mcp/server.ts` - NEW
    - `src/mcp/errors.ts` - NEW
    - `src/cli/commands/mcp.ts` - NEW
    - `src/cli/program.ts` - MODIFIED
    - `tests/mcp/server-start.test.ts` - NEW
  - **Implementation:** support `--store`, `--read-only`, `--include-private`, `--default-actor`, `--log-file`. Hide `.notch/private/` seed packets unless `--include-private` is present. Protocol output on stdio; diagnostics on stderr or the configured log file.
  - **Dependencies:** Steps 2.7, 3.1, 5.1.
  - **Verification:** `npm test -- server-start`; MCP initialize succeeds; startup failures map to exit code `4`.

- [ ] **Step 6.2: MCP brief tools**
  - **Files:**
    - `src/mcp/tools/get-brief.ts` - NEW
    - `src/mcp/tools/create-brief.ts` - NEW
    - `src/mcp/tools/list-briefs.ts` - NEW
    - `src/mcp/tools/get-targeted-brief.ts` - NEW
    - `src/mcp/tools/index.ts` - NEW
    - `tests/mcp/brief-tools.test.ts` - NEW
  - **Implementation:** register `get_brief`, `create_brief`, `list_briefs`, `get_targeted_brief`. Attribute MCP writes as agent-authored and unreviewed by default. Reject out-of-project scope files.
  - **Dependencies:** Steps 4.1, 6.1.
  - **Verification:** `npm test -- brief-tools`; valid writes audit exactly once.

- [ ] **Step 6.3: MCP packet tools**
  - **Files:**
    - `src/mcp/tools/create-packet.ts` - NEW
    - `src/mcp/tools/import-packet.ts` - NEW
    - `src/mcp/tools/list-packets.ts` - NEW
    - `src/mcp/tools/get-packet.ts` - NEW
    - `src/mcp/tools/create-seed-packet.ts` - NEW
    - `src/mcp/tools/import-seed-packet.ts` - NEW
    - `src/mcp/tools/index.ts` - MODIFIED
    - `tests/mcp/packet-tools.test.ts` - NEW
  - **Implementation:** register `create_packet`, `import_packet`, `list_packets`, `get_packet`, `create_seed_packet`, `import_seed_packet`. Keep MCP import scoped to the current store; CLI owns cross-store destinations. Allow MCP clients to create packets from selected/summarized session context supplied in tool input; forbid hidden reads of chat/project internals. Enforce read-only mode; gate private packet reads behind `--include-private`. Emit `NOTCH_SUMMARY_LARGE` warning when `summary` > 5000 chars and no `include`/`sourceLinks` are supplied.
  - **Dependencies:** Steps 4.2, 6.1.
  - **Verification:** `npm test -- packet-tools`; MCP can create outbox packets, import a supplied packet into inbox/private inbox, hide private packets by default, and read list/show without arbitrary filesystem access; `importedFrom` stored as basename.

- [ ] **Step 6.4: MCP status, doctor, and read-only enforcement**
  - **Files:**
    - `src/mcp/tools/get-status.ts` - NEW
    - `src/mcp/tools/run-doctor.ts` - NEW
    - `src/mcp/tools/index.ts` - MODIFIED
    - `tests/mcp/status-doctor-tools.test.ts` - NEW
    - `tests/mcp/read-only-mode.test.ts` - NEW
  - **Implementation:** register `get_status` and `run_doctor`. In `--read-only`, reject every write tool and `run_doctor({ fixDerivedState: true })`. Treat an empty `config.defaults.allowedMcpWriteTools` as effective read-only for writes while keeping reads available.
  - **Dependencies:** Steps 4.3, 6.1.
  - **Verification:** `npm test -- status-doctor-tools read-only-mode`; write tools fail with `NOTCH_MCP_READ_ONLY` under both `--read-only` and empty allowlist.

### Wave 7: Hardening, Fixtures, Docs, CI

- [ ] **Step 7.1: Security and corrupt-store integration tests**
  - **Files:**
    - `tests/cli/corrupt-store.test.ts` - NEW
    - `tests/cli/path-traversal.test.ts` - NEW
    - `tests/cli/audit-integration.test.ts` - NEW
    - `tests/cli/secret-scan.test.ts` - NEW
    - `tests/cli/cross-store-destination.test.ts` - NEW
  - **Implementation:** bad YAML, duplicate IDs, broken audit JSONL, absolute paths, sibling traversal, symlink rejection, secret-like input, destinations without `.notch/config.json`.
  - **Dependencies:** Steps 3.2, 3.5, 3.6, 4.2, 4.3, 5.2–5.5.
  - **Verification:** `npm test -- corrupt-store path-traversal audit-integration secret-scan cross-store-destination`.

- [ ] **Step 7.2: Demo fixtures**
  - **Files:**
    - `fixtures/cross-repo-demo/source-app/.notch/config.json` - NEW
    - `fixtures/cross-repo-demo/source-app/.notch/.gitignore` - NEW
    - `fixtures/cross-repo-demo/source-app/.notch/brief.md` - NEW
    - `fixtures/cross-repo-demo/source-app/.notch/briefs/20260523T171500Z-marketing-context-for-claude.md` - NEW
    - `fixtures/cross-repo-demo/source-app/.notch/outbox/20260523T172000Z-current-state-to-marketing.md` - NEW
    - `fixtures/cross-repo-demo/destination-marketing/.notch/config.json` - NEW
    - `fixtures/cross-repo-demo/destination-marketing/.notch/.gitignore` - NEW
    - `fixtures/cross-repo-demo/destination-marketing/.notch/brief.md` - NEW
    - `fixtures/cross-repo-demo/destination-marketing/.notch/inbox/20260523T172000Z-current-state-from-source-app.md` - NEW
    - `fixtures/context-seed-demo/old-project/.notch/config.json` - NEW
    - `fixtures/context-seed-demo/old-project/.notch/brief.md` - NEW
    - `fixtures/context-seed-demo/new-project/.notch/config.json` - NEW
    - `fixtures/context-seed-demo/new-project/.notch/private/inbox/20260523T173000Z-user-workflow-seed-from-old-project.md` - NEW
    - `fixtures/cross-tool-handoff-demo/claude-desktop-session-packet.md` - NEW
    - `fixtures/cross-repo-demo/README.md` - NEW
  - **Implementation:** model the killer demo (Claude Code → Claude Desktop with current repo state for marketing copy basis), plus private workflow seeding from old to new project, plus a packet created from explicitly supplied Claude Desktop session context (selected summary, exclusions, source links, never raw chat). Keep `index/` and `logs/` absent or regenerable.
  - **Dependencies:** Steps 2.3, 2.4, 2.5, 4.2, 4.3.
  - **Verification:** `notch doctor --cwd <fixture> --fix --yes` reports healthy for each fixture; private seed is git-ignored; destination packet list returns the imported packet.

- [ ] **Step 7.3: README and workflow docs**
  - **Files:**
    - `README.md` - MODIFIED
    - `docs/private-context-seeding.md` - NEW
    - `docs/cross-repo-packets.md` - NEW
    - `docs/cross-tool-handoff.md` - NEW
    - `docs/targeted-brief-workflow.md` - NEW
    - `docs/mcp-setup.md` - NEW
    - `docs/privacy.md` - NEW
  - **Implementation:** lead with the Claude Desktop ↔ Claude Code marketing-copy-from-repo-state demo. Explain consent model: a user asks an AI client to create a packet, the client supplies selected/summarized context through MCP, 3Notch writes a reviewable artifact. Explain integration posture: local MCP first, Claude Desktop DXT later, remote connector later. Include `npx @3notch/cli onboard`, `notch seed from`, `notch packet create`, `notch packet import`, `notch brief`, `notch brief create`, `notch status`, `notch doctor`, `notch mcp serve --include-private`.
  - **Dependencies:** Steps 5.2 through 6.4, 7.2.
  - **Verification:** manually run every README quickstart command in a temp project and confirm outputs match the documented flow.

- [ ] **Step 7.4: Agent workflow prompts**
  - **Files:**
    - `docs/prompts/claude-desktop-to-claude-code.md` - NEW
    - `docs/prompts/cross-repo-handoff.md` - NEW
    - `docs/prompts/private-seed-from-prior-work.md` - NEW
  - **Implementation:** reference MCP tools by V1 names. Include Claude Desktop to Claude Code/Codex wording that asks for a scoped packet, explicit exclusions, and review before import. Focus prompts on source-linked context, not on session-end discipline.
  - **Dependencies:** Steps 6.2–6.4, 7.2.
  - **Verification:** review prompt files for no claims about chat-history scraping, telemetry, cloud sync, semantic search, autonomous orchestration, or session-end ritual.

- [ ] **Step 7.5: CI matrix, telemetry regression guard, deferred-surface guard**
  - **Files:**
    - `.github/workflows/ci.yml` - MODIFIED
    - `tests/helpers/package-inspection.ts` - NEW
    - `tests/unit/no-telemetry-deps.test.ts` - NEW
    - `tests/unit/no-deferred-commands.test.ts` - NEW
  - **Implementation:**
    - Expand CI to a matrix of `os: [ubuntu-latest, macos-latest, windows-latest]` and `node: [20, 22]`. Add `npm run test:e2e` to the workflow.
    - Telemetry denylist: scan `package.json`, `package-lock.json`, source files, and built output for `analytics`, `mixpanel`, `posthog`, `segment`, `sentry`, `telemetry`.
    - Deferred-surface guard: assert no source file registers a `pass`, `send`, `decision`, `question`, `conflict`, or `stale` Commander command or MCP tool name. Prevents accidental re-introduction.
  - **Dependencies:** Steps 1.1, 1.2, 7.3.
  - **Verification:** `npm test -- no-telemetry-deps no-deferred-commands`; CI YAML contains lint, type-check, build, unit tests, and e2e tests across the matrix.

### Final Step: End-to-End Smoke Tests

- [ ] **Step 8.1: Cross-repo packet, private seed, and cross-tool handoff smoke**
  - **Files:**
    - `tests/e2e/cross-repo-packet-smoke.test.ts` - NEW
    - `tests/e2e/private-context-seed-smoke.test.ts` - NEW
    - `tests/e2e/cross-tool-handoff-smoke.test.ts` - NEW
    - `tests/e2e/local-privacy.test.ts` - NEW
    - `tests/helpers/mcp-harness.ts` - MODIFIED
    - `package.json` - MODIFIED
  - **Implementation:**
    - Cross-repo: create two temp projects, run `notch onboard --yes` in both, create a targeted brief in repo A, create a packet referencing it, import into repo B, list/show the packet from repo B, run status/doctor, start MCP harness, call `tools/list`, fetch the imported packet via `get_packet`.
    - Private seed: create an old temp project and a new temp project, seed private context from old into new, verify private seed is ignored and hidden from MCP by default, then enable private context and read it via `list_packets({ includePrivate: true })`.
    - Cross-tool handoff: use the MCP harness to create a packet from explicitly supplied "Claude Desktop session" content (summary + exclusions + source links), import it into another temp store, verify no arbitrary chat/project read tool exists.
    - Local privacy: assert no required MCP tools touch files outside `.notch/` except the explicit packet path supplied to `import_packet`/`import_seed_packet`; assert no network calls.
  - **Dependencies:** Steps 1.1 through 7.5.
  - **Verification:** `npm run lint && npm run type-check && npm run build && npm test && npm run test:e2e`.

### Future Considerations

Hosted encrypted sync, teams, managed MCP endpoints, Claude Desktop DXT packaging, remote MCP connectors, browser UI, Homebrew distribution, SQLite/FTS, semantic search, chat export importers, review workflows, pass/decision/question/conflict/stale record types if a packet-transfer use case proves they earn their keep, and 3Notch repo self-hosting a committed `.notch/brief.md`. All deferred from V1.
