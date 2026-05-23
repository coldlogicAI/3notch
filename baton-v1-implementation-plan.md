## Implementation Plan: Baton V1 MVP

### Assumptions

- The current repo is documentation-only, so all package/runtime files are new unless explicitly marked modified later.
- `baton-v1-technical-spec.md` is authoritative where it conflicts with older request language: V1 uses `.baton/config.json`, Markdown/YAML records, and regenerable JSON manifest/index files, with no SQLite.
- V1 implements the required CLI and MCP surfaces only; `baton search`, assumption-specific commands, hosted sync, semantic search, dashboards, telemetry, and provider-specific deep config mutation are deferred.
- The package uses Node.js 20+, TypeScript, Commander, Ajv, Vitest, tsup, and `@modelcontextprotocol/sdk`.

### Wave 1: Package and Foundation

- [ ] **Step 1.1: Add npm package manifest**
  - **Task:** Create the installable `baton` package with scripts, runtime dependencies, dev dependencies, bin metadata, and package files.
  - **Files:**
    - `package.json` - NEW
    - `package-lock.json` - NEW
  - **Implementation:**
    - Set package name to `baton`, ESM module type, Node 20 engine, and `bin.baton` pointing at the built CLI.
    - Add dependencies for Commander, Ajv, Markdown/YAML parsing, MCP SDK, and CLI output helpers.
    - Add scripts for `lint`, `type-check`, `build`, `test`, and `test:e2e`.
  - **Dependencies:** None
  - **Verification:** Run `npm install`; `npm run build` should fail only because source entry files are not created yet, not because package metadata is invalid.

- [ ] **Step 1.2: Add TypeScript, build, lint, and test config**
  - **Task:** Configure TypeScript compilation, bundling, linting, Vitest, and ignored build artifacts.
  - **Files:**
    - `tsconfig.json` - NEW
    - `tsup.config.ts` - NEW
    - `vitest.config.ts` - NEW
    - `eslint.config.mjs` - NEW
    - `.gitignore` - NEW
  - **Implementation:**
    - Configure strict TypeScript with source under `src/` and tests under `tests/`.
    - Build CLI output into `dist/` with executable banner preservation.
    - Configure Vitest for isolated temp filesystem tests.
  - **Dependencies:** Step 1.1
  - **Verification:** Run `npm run type-check`; it should pass once Step 1.3 creates entry files.

- [ ] **Step 1.3: Add CLI entry skeleton**
  - **Task:** Add a minimal Commander CLI that exposes help, version, global flags, and stable output helpers.
  - **Files:**
    - `src/cli/index.ts` - NEW
    - `src/cli/program.ts` - NEW
    - `src/cli/output.ts` - NEW
    - `src/core/version.ts` - NEW
    - `tests/cli/help.test.ts` - NEW
  - **Implementation:**
    - Wire `baton --help`, `baton --version`, and global flags without real commands yet.
    - Ensure JSON and quiet output helpers are testable without process globals.
  - **Dependencies:** Step 1.2
  - **Verification:** Run `npm test -- help`; help output includes `baton`, global flags, and exits `0`.

- [ ] **Step 1.4: Add test harness helpers**
  - **Task:** Create reusable helpers for CLI execution, temp projects, fixture stores, and MCP harness tests.
  - **Files:**
    - `tests/helpers/run-cli.ts` - NEW
    - `tests/helpers/temp-project.ts` - NEW
    - `tests/helpers/store-fixtures.ts` - NEW
    - `tests/helpers/mcp-harness.ts` - NEW
  - **Implementation:**
    - Implement isolated temp directories with optional Git repo initialization.
    - Provide helpers for invoking built or tsx-powered CLI commands with stdout, stderr, and exit code capture.
  - **Dependencies:** Step 1.3
  - **Verification:** Run `npm test -- helpers`; helper self-tests create and clean temp project directories.

### Wave 2: Schemas and Record Parsing

- [ ] **Step 2.1: Add core record and error types**
  - **Task:** Define shared TypeScript types for Baton records, actors, source links, command inputs, and structured errors.
  - **Files:**
    - `src/types/records.ts` - NEW
    - `src/types/errors.ts` - NEW
    - `src/types/commands.ts` - NEW
    - `tests/unit/types.test.ts` - NEW
  - **Implementation:**
    - Encode `RecordMeta`, `BatonPass`, `BatonBrief`, `ProjectBrief`, `DecisionRecord`, `OpenQuestionRecord`, `ConflictRecord`, `AuditEntry`, and `BatonError`.
    - Keep MCP and CLI transport concerns out of the core record types.
  - **Dependencies:** Step 1.2
  - **Verification:** Run `npm test -- types`; fixtures compile against the expected literal unions.

- [ ] **Step 2.2: Add schema service and base schemas**
  - **Task:** Add Ajv-backed validation for shared definitions, config, and audit log entries.
  - **Files:**
    - `src/schemas/shared.schema.json` - NEW
    - `src/schemas/config.schema.json` - NEW
    - `src/schemas/audit.schema.json` - NEW
    - `src/core/schema-service.ts` - NEW
    - `tests/schema/base-schemas.test.ts` - NEW
  - **Implementation:**
    - Configure Ajv strict mode with reusable shared definitions for actor, source tool, source link, tags, and schema version.
    - Validate audit entries with separate `actorNameResolution` and `actorTypeResolution` fields.
    - Return normalized `BatonError` objects for validation failures.
  - **Dependencies:** Step 2.1
  - **Verification:** Run `npm test -- base-schemas`; valid config/audit examples pass and malformed examples fail with `BATON_RECORD_INVALID` or `BATON_CONFIG_INVALID`.

- [ ] **Step 2.3: Add project brief schema and fixtures**
  - **Task:** Define and test the default `.baton/brief.md` project brief format.
  - **Files:**
    - `src/schemas/project-brief.schema.json` - NEW
    - `src/templates/project-brief.md` - NEW
    - `tests/fixtures/valid-project-brief.md` - NEW
    - `tests/fixtures/invalid-project-brief-missing-heading.md` - NEW
    - `tests/schema/project-brief-schema.test.ts` - NEW
  - **Implementation:**
    - Require project brief metadata and body headings for current focus, decisions, recent passes, open questions, and warnings.
    - Validate `recordType: project_brief`, quoted semver-compatible `schemaVersion`, tags, source links, and review status.
  - **Dependencies:** Step 2.2
  - **Verification:** Run `npm test -- project-brief-schema`; valid fixture passes and missing-heading fixture fails.

- [ ] **Step 2.4: Add pass schema and fixtures**
  - **Task:** Define and test Baton pass records.
  - **Files:**
    - `src/schemas/pass.schema.json` - NEW
    - `src/templates/pass.md` - NEW
    - `tests/fixtures/valid-pass.md` - NEW
    - `tests/fixtures/invalid-pass-missing-summary.md` - NEW
    - `tests/schema/pass-schema.test.ts` - NEW
  - **Implementation:**
    - Require `title`, `currentTask`, `summary`, `nextActions`, `confidence`, and common metadata.
    - Validate pass headings for summary, changed files, decisions, blockers, open questions, and next actions.
  - **Dependencies:** Step 2.2
  - **Verification:** Run `npm test -- pass-schema`; invalid fixture fails with a missing required field or heading.

- [ ] **Step 2.5: Add targeted brief schema and fixtures**
  - **Task:** Define and test targeted brief records.
  - **Files:**
    - `src/schemas/brief.schema.json` - NEW
    - `src/templates/targeted-brief.md` - NEW
    - `tests/fixtures/valid-targeted-brief.md` - NEW
    - `tests/fixtures/invalid-targeted-brief-missing-goal.md` - NEW
    - `tests/schema/targeted-brief-schema.test.ts` - NEW
  - **Implementation:**
    - Require target agent, goal, scope, exclusions, design basis, prior reasoning summary, and required body sections.
    - Allow empty exclusions only when explicitly stored as `[]`.
  - **Dependencies:** Step 2.2
  - **Verification:** Run `npm test -- targeted-brief-schema`; valid fixture passes and missing goal fails.

- [ ] **Step 2.6: Add decision, question, and conflict schemas**
  - **Task:** Define and test the remaining source-of-truth context record schemas.
  - **Files:**
    - `src/schemas/decision.schema.json` - NEW
    - `src/schemas/question.schema.json` - NEW
    - `src/schemas/conflict.schema.json` - NEW
    - `tests/schema/context-record-schemas.test.ts` - NEW
  - **Implementation:**
    - Validate decision rationale/scope/confidence, question active/archive status, and conflict record references/resolution fields.
    - Require conflict records to contain at least two distinct `conflictingRecords` IDs.
    - Keep records intentionally thin for V1.
  - **Dependencies:** Step 2.2
  - **Verification:** Run `npm test -- context-record-schemas`; invalid statuses and missing required fields fail.

- [ ] **Step 2.7: Add decision, question, and conflict templates**
  - **Task:** Add human-readable Markdown templates for secondary record creation.
  - **Files:**
    - `src/templates/decision.md` - NEW
    - `src/templates/question.md` - NEW
    - `src/templates/conflict.md` - NEW
    - `tests/unit/templates.test.ts` - NEW
  - **Implementation:**
    - Match template frontmatter and headings to the schemas.
    - Keep templates readable and editable without Baton.
  - **Dependencies:** Step 2.6
  - **Verification:** Run `npm test -- templates`; generated template frontmatter validates against each schema.

- [ ] **Step 2.8: Add Markdown/YAML record parser**
  - **Task:** Parse persisted Markdown records, validate YAML frontmatter, and enforce required body headings.
  - **Files:**
    - `src/core/markdown-service.ts` - NEW
    - `src/core/record-parser.ts` - NEW
    - `tests/unit/record-parser.test.ts` - NEW
    - `tests/fixtures/bad-yaml.md` - NEW
    - `tests/fixtures/missing-required-heading.md` - NEW
  - **Implementation:**
    - Coerce scalar `schemaVersion` values to strings before schema validation.
    - Return parsed metadata, Markdown body, and structured errors without throwing raw parser errors.
  - **Dependencies:** Steps 2.2, 2.3, 2.4, 2.5, 2.6
  - **Verification:** Run `npm test -- record-parser`; bad YAML returns `BATON_CORRUPT_RECORD` and missing headings return `BATON_RECORD_INVALID`.

- [ ] **Step 2.9: Add status and MCP input schemas**
  - **Task:** Add schema coverage for status output and all required MCP tool input schemas.
  - **Files:**
    - `src/schemas/status.schema.json` - NEW
    - `src/schemas/mcp-tools.schema.json` - NEW
    - `src/mcp/tool-schemas.ts` - NEW
    - `tests/schema/status-schema.test.ts` - NEW
    - `tests/schema/mcp-tool-schemas.test.ts` - NEW
  - **Implementation:**
    - Treat `src/schemas/mcp-tools.schema.json` as the canonical MCP input-schema source.
    - Make `src/mcp/tool-schemas.ts` load and export schemas from the packaged JSON file instead of redefining schemas in TypeScript.
    - Define input schemas for every required MCP tool, including read-only-safe status and doctor inputs.
    - Enforce limits such as recent pass limit `1..10` and valid confidence/status enums.
  - **Dependencies:** Step 2.2
  - **Verification:** Run `npm test -- mcp-tool-schemas status-schema`; all required MCP tool names have concrete JSON Schemas and runtime tool schemas are loaded from `src/schemas/mcp-tools.schema.json`.

### Wave 3: Store, Validation, Audit, and Index

- [ ] **Step 3.1: Add config and store discovery**
  - **Task:** Resolve project roots, store paths, initial config, and required `.baton/` folder layout.
  - **Files:**
    - `src/core/config-service.ts` - NEW
    - `src/core/store-layout.ts` - NEW
    - `tests/unit/config-service.test.ts` - NEW
    - `tests/fixtures/config-valid.json` - NEW
    - `tests/fixtures/config-invalid.json` - NEW
  - **Implementation:**
    - Support `--cwd` and `--store`, default `.baton/`, and Git-root detection.
    - Validate config with `config.schema.json` and warn on unknown top-level fields.
  - **Dependencies:** Steps 2.2, 2.8
  - **Verification:** Run `npm test -- config-service`; missing store maps to exit code `2`.

- [ ] **Step 3.2: Add path safety and symlink rejection**
  - **Task:** Enforce project-relative source links and reject unsafe paths and store symlinks.
  - **Files:**
    - `src/core/path-safety.ts` - NEW
    - `tests/unit/path-safety.test.ts` - NEW
  - **Implementation:**
    - Reject absolute paths, `~`, sibling traversal, paths resolving outside `config.project.root`, and symlinks inside `.baton/`.
    - Expose helpers for CLI, MCP, doctor, and store services.
  - **Dependencies:** Step 3.1
  - **Verification:** Run `npm test -- path-safety`; traversal attempts fail with `BATON_PATH_OUTSIDE_PROJECT`, relative backslash-separated paths normalize safely, and drive-letter absolute paths plus backslash traversal are rejected.

- [ ] **Step 3.3: Add ID, actor, and metadata factory services**
  - **Task:** Generate deterministic IDs, slugs, filenames, actor metadata, source tool metadata, and common record metadata.
  - **Files:**
    - `src/core/id-service.ts` - NEW
    - `src/core/actor-service.ts` - NEW
    - `src/core/record-factory.ts` - NEW
    - `tests/unit/record-factory.test.ts` - NEW
  - **Implementation:**
    - Resolve actor display name from flags, Git config, environment, or unknown.
    - Track actor display-name resolution separately from actor-type resolution for audit entries.
    - Default CLI writes to human/reviewed and MCP writes to agent/unreviewed.
  - **Dependencies:** Step 2.1
  - **Verification:** Run `npm test -- record-factory`; generated records include actor, timestamp, source tool, record type, and schema version.

- [ ] **Step 3.4: Add atomic store read/write and file scanning**
  - **Task:** Implement safe source-record reads, atomic writes, collision handling, and record directory scans.
  - **Files:**
    - `src/core/store-service.ts` - NEW
    - `tests/unit/store-service.test.ts` - NEW
  - **Implementation:**
    - Write to temp files and rename into place.
    - Scan only allowed `.baton/` source directories and ignore invalid records unless requested by doctor.
  - **Dependencies:** Steps 3.1, 3.2, 2.8
  - **Verification:** Run `npm test -- store-service`; explicit slug collisions fail while auto-generated ID and filename collisions suffix safely with `-2`, `-3`, and so on.

- [ ] **Step 3.5: Add audit logging**
  - **Task:** Append exactly one JSONL audit event for each successful or blocked write operation.
  - **Files:**
    - `src/core/audit-service.ts` - NEW
    - `tests/unit/audit-service.test.ts` - NEW
    - `tests/fixtures/audit-corrupt.jsonl` - NEW
  - **Implementation:**
    - Write `.baton/logs/audit.jsonl` append-only entries matching `audit.schema.json`.
    - Surface `BATON_AUDIT_WRITE_FAILED` when record write succeeds but audit append fails.
  - **Dependencies:** Steps 2.2, 3.3, 3.4
  - **Verification:** Run `npm test -- audit-service`; every successful write fixture produces one valid audit line.

- [ ] **Step 3.6: Add secret scanning**
  - **Task:** Block writes containing configured redaction patterns or likely high-entropy secrets.
  - **Files:**
    - `src/core/secret-scan-service.ts` - NEW
    - `tests/unit/secret-scan-service.test.ts` - NEW
  - **Implementation:**
    - Detect configured regexes, JWTs, SSH private keys, and token-like 32+ character strings.
    - Emit `BATON_SECRET_DETECTED` and require audit operation `secret-blocked`.
  - **Dependencies:** Steps 3.1, 3.5
  - **Verification:** Run `npm test -- secret-scan-service`; blocked writes do not create source records and append one `secret-blocked` audit entry.

- [ ] **Step 3.7: Add derived JSON index service**
  - **Task:** Build regenerable `.baton/index/records.json` and `.baton/index/manifest.json` from source files.
  - **Files:**
    - `src/core/index-service.ts` - NEW
    - `src/types/index.ts` - NEW
    - `tests/unit/index-service.test.ts` - NEW
  - **Implementation:**
    - Index record IDs, slugs, record types, status, tags, target agents, timestamps, and paths.
    - Treat index files as derived state that can be deleted and rebuilt.
  - **Dependencies:** Steps 3.4, 3.5
  - **Verification:** Run `npm test -- index-service`; deleting `index/` and rebuilding reproduces the same manifest from source records.

- [ ] **Step 3.8: Add pass and brief services**
  - **Task:** Implement core create/list/get behavior for passes, default project brief reads, and targeted briefs.
  - **Files:**
    - `src/core/pass-service.ts` - NEW
    - `src/core/brief-service.ts` - NEW
    - `tests/unit/pass-service.test.ts` - NEW
    - `tests/unit/brief-service.test.ts` - NEW
  - **Implementation:**
    - Validate paths, scan secrets, validate schemas, write records, append audit entries, and update index.
    - Resolve latest pass by newest valid active `createdAt`, then filename.
  - **Dependencies:** Steps 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
  - **Verification:** Run `npm test -- pass-service brief-service`; created records validate and have exactly one audit event.

- [ ] **Step 3.9: Add decision, question, conflict, and stale services**
  - **Task:** Implement core services for secondary context records and stale/resolution rewrites.
  - **Files:**
    - `src/core/decision-service.ts` - NEW
    - `src/core/question-service.ts` - NEW
    - `src/core/conflict-service.ts` - NEW
    - `src/core/stale-service.ts` - NEW
    - `tests/unit/context-services.test.ts` - NEW
  - **Implementation:**
    - Create/list decisions and questions, create/list/resolve conflicts, and mark records stale without deletion.
    - Reject stale marking for the default project brief and treat already stale or superseded records as no-op warnings.
    - Preserve `createdAt`, set `updatedAt`, append stale/resolution notes to Markdown, and audit rewrites.
  - **Dependencies:** Steps 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
  - **Verification:** Run `npm test -- context-services`; stale and conflict resolve operations rewrite only allowed Baton source records, default project brief stale marking is rejected, and stale/superseded records return no-op warnings.

- [ ] **Step 3.10: Add status and doctor services**
  - **Task:** Compute project status summaries and full store diagnostics with safe derived fixes.
  - **Files:**
    - `src/core/status-service.ts` - NEW
    - `src/core/doctor-service.ts` - NEW
    - `tests/unit/status-service.test.ts` - NEW
    - `tests/unit/doctor-service.test.ts` - NEW
    - `tests/fixtures/corrupt-store.md` - NEW
  - **Implementation:**
    - Report latest pass, open briefs, active decisions, open questions, conflicts, stale records, validation counts, and warnings.
    - Validate store structure, schemas, IDs, source links, audit log, symlinks, secrets, MCP write config, and `.baton/.gitignore`.
  - **Dependencies:** Steps 3.1 through 3.9
  - **Verification:** Run `npm test -- status-service doctor-service`; corrupt YAML is reported as corruption and `doctor --fix` behavior is limited to derived state.

### Wave 4: CLI Commands

- [ ] **Step 4.1: Add global CLI runtime plumbing**
  - **Task:** Connect global flags, actor resolution, JSON output, quiet mode, color control, and exit-code mapping.
  - **Files:**
    - `src/cli/context.ts` - NEW
    - `src/cli/errors.ts` - NEW
    - `src/cli/formatters.ts` - NEW
    - `src/cli/program.ts` - MODIFIED
    - `tests/cli/global-flags.test.ts` - NEW
  - **Implementation:**
    - Map `BatonError.exitCode` to specified CLI exit codes.
    - Ensure `--json` output is machine-readable and `--quiet` suppresses non-error text.
  - **Dependencies:** Steps 1.3, 3.1, 3.3
  - **Verification:** Run `npm test -- global-flags`; invalid store emits JSON error with exit code `2`.

- [ ] **Step 4.2: Add `baton onboard`**
  - **Task:** Initialize `.baton/` stores with config, starter brief, required folders, `.baton/.gitignore`, and MCP setup instructions.
  - **Files:**
    - `src/cli/commands/onboard.ts` - NEW
    - `src/cli/mcp-instructions.ts` - NEW
    - `src/cli/program.ts` - MODIFIED
    - `tests/cli/onboard.test.ts` - NEW
    - `tests/fixtures/baton-gitignore.txt` - NEW
  - **Implementation:**
    - Support `--name`, `--yes`, `--mcp`, `--force`, and `--json`.
    - Mutate known Claude Desktop/Cursor MCP config files only after explicit confirmation, using injectable config-home paths for tests.
    - Print copy-pasteable MCP configuration instructions when a client path is unsupported or mutation is not confirmed.
    - Never overwrite existing source records silently; only repair missing starter files with `--force`.
  - **Dependencies:** Steps 3.1, 3.4, 3.5, 4.1
  - **Verification:** Run `npm test -- onboard`; `baton onboard --name my-app --yes --json` creates a healthy store, `.baton/.gitignore` contains `index/` and `logs/`, and `--mcp claude-desktop` mutates only the expected temp config path or prints fallback instructions when unsupported.

- [ ] **Step 4.3: Add `baton brief` command family**
  - **Task:** Implement default project brief display plus targeted brief create/list/show commands.
  - **Files:**
    - `src/cli/commands/brief.ts` - NEW
    - `src/cli/formatters/brief-formatters.ts` - NEW
    - `src/cli/program.ts` - MODIFIED
    - `tests/cli/brief.test.ts` - NEW
    - `tests/cli/targeted-brief.test.ts` - NEW
  - **Implementation:**
    - Implement `baton brief`, `baton brief create`, `baton brief list`, and `baton brief show <id>`.
    - Support interactive prompts, `--stdin`, `--editor`, filters, JSON output, slug collision rules, and path validation.
  - **Dependencies:** Steps 3.8, 4.1
  - **Verification:** Run `npm test -- brief targeted-brief`; create/list/show works by ID and slug, and invalid paths exit `5`.

- [ ] **Step 4.4: Add `baton pass`**
  - **Task:** Implement interactive and non-interactive pass creation.
  - **Files:**
    - `src/cli/commands/pass.ts` - NEW
    - `src/cli/interactive.ts` - NEW
    - `src/cli/program.ts` - MODIFIED
    - `tests/cli/pass.test.ts` - NEW
  - **Implementation:**
    - Support all required flags, `--stdin`, `--editor`, default confidence warning, and repeatable files/decisions/blockers/questions/next actions.
    - Prompt for exactly the specified interactive questions.
  - **Dependencies:** Steps 3.8, 4.1
  - **Verification:** Run `npm test -- pass`; non-interactive pass creation returns created ID/path and writes one audit entry, and `baton pass --agent codex` writes `actorType: agent` with `reviewStatus: unreviewed`.

- [ ] **Step 4.5: Add decision and question commands**
  - **Task:** Implement decision and open-question creation/listing through CLI.
  - **Files:**
    - `src/cli/commands/decision.ts` - NEW
    - `src/cli/commands/question.ts` - NEW
    - `src/cli/program.ts` - MODIFIED
    - `tests/cli/decision.test.ts` - NEW
    - `tests/cli/question.test.ts` - NEW
  - **Implementation:**
    - Implement `baton decision add`, `baton decision list`, `baton question add`, and `baton question list`.
    - Support filters, JSON output, stdin/editor inputs, and default confidence for decisions.
  - **Dependencies:** Steps 3.9, 4.1
  - **Verification:** Run `npm test -- decision question`; active records list correctly and malformed related records fail.

- [ ] **Step 4.6: Add stale and conflict commands**
  - **Task:** Implement stale marking and conflict create/list/resolve workflows.
  - **Files:**
    - `src/cli/commands/stale.ts` - NEW
    - `src/cli/commands/conflict.ts` - NEW
    - `src/cli/program.ts` - MODIFIED
    - `tests/cli/stale.test.ts` - NEW
    - `tests/cli/conflict.test.ts` - NEW
  - **Implementation:**
    - Implement `baton stale mark <id>`, `baton conflict add`, `baton conflict list`, and `baton conflict resolve <id>`.
    - Require conflict creation to reference at least two distinct existing records.
  - **Dependencies:** Steps 3.9, 4.1
  - **Verification:** Run `npm test -- stale conflict`; stale records remain inspectable, resolved conflicts become archived, and duplicate conflict record IDs are rejected.

### Wave 5: MCP Server

- [ ] **Step 5.1: Add stdio MCP server foundation**
  - **Task:** Start `baton mcp serve` over stdio with scoped store context, tool registration plumbing, and MCP error mapping.
  - **Files:**
    - `src/mcp/server.ts` - NEW
    - `src/mcp/errors.ts` - NEW
    - `src/cli/commands/mcp.ts` - NEW
    - `src/cli/program.ts` - MODIFIED
    - `tests/mcp/server-start.test.ts` - NEW
  - **Implementation:**
    - Support `--store`, `--read-only`, `--default-actor`, and `--log-file`.
    - Keep protocol output on stdio and diagnostics on stderr or the configured log file.
  - **Dependencies:** Steps 2.9, 3.1, 4.1
  - **Verification:** Run `npm test -- server-start`; MCP initialize succeeds and startup failures map to exit code `4`.

- [ ] **Step 5.2: Add MCP brief and pass read tools**
  - **Task:** Implement read-only cold-start tools for project brief and recent passes.
  - **Files:**
    - `src/mcp/tools/get-brief.ts` - NEW
    - `src/mcp/tools/get-latest-pass.ts` - NEW
    - `src/mcp/tools/get-recent-passes.ts` - NEW
    - `src/mcp/tools/index.ts` - NEW
    - `tests/mcp/read-tools.test.ts` - NEW
  - **Implementation:**
    - Register `get_brief`, `get_latest_pass`, and `get_recent_passes`.
    - Enforce schemas, default recent pass limit `3`, and max limit `10`.
  - **Dependencies:** Steps 3.8, 5.1
  - **Verification:** Run `npm test -- read-tools`; tools read only `.baton/` records and return warnings for skipped invalid records.

- [ ] **Step 5.3: Add MCP targeted brief tools**
  - **Task:** Implement targeted brief creation, listing, and lookup tools.
  - **Files:**
    - `src/mcp/tools/create-brief.ts` - NEW
    - `src/mcp/tools/list-briefs.ts` - NEW
    - `src/mcp/tools/get-targeted-brief.ts` - NEW
    - `src/mcp/tools/index.ts` - MODIFIED
    - `tests/mcp/brief-tools.test.ts` - NEW
  - **Implementation:**
    - Register `create_brief`, `list_briefs`, and `get_targeted_brief`.
    - Attribute MCP writes as agent-authored and unreviewed by default.
  - **Dependencies:** Steps 3.8, 5.1
  - **Verification:** Run `npm test -- brief-tools`; out-of-project scope files are rejected and valid writes audit exactly once.

- [ ] **Step 5.4: Add MCP pass and decision tools**
  - **Task:** Implement pass creation and decision create/list MCP tools.
  - **Files:**
    - `src/mcp/tools/create-pass.ts` - NEW
    - `src/mcp/tools/record-decision.ts` - NEW
    - `src/mcp/tools/get-decisions.ts` - NEW
    - `src/mcp/tools/index.ts` - MODIFIED
    - `tests/mcp/pass-decision-tools.test.ts` - NEW
  - **Implementation:**
    - Register `create_pass`, `record_decision`, and `get_decisions`.
    - Validate all source links and block secrets before writes.
  - **Dependencies:** Steps 3.8, 3.9, 5.1
  - **Verification:** Run `npm test -- pass-decision-tools`; created records include source tool `baton-mcp`.

- [ ] **Step 5.5: Add MCP question and stale tools**
  - **Task:** Implement open-question and stale-marking MCP tools.
  - **Files:**
    - `src/mcp/tools/add-open-question.ts` - NEW
    - `src/mcp/tools/get-open-questions.ts` - NEW
    - `src/mcp/tools/mark-context-stale.ts` - NEW
    - `src/mcp/tools/index.ts` - MODIFIED
    - `tests/mcp/question-stale-tools.test.ts` - NEW
  - **Implementation:**
    - Register `add_open_question`, `get_open_questions`, and `mark_context_stale`.
    - Ensure stale updates cannot modify config, logs, or derived index files.
  - **Dependencies:** Steps 3.9, 5.1
  - **Verification:** Run `npm test -- question-stale-tools`; stale writes preserve `createdAt` and set `updatedAt`.

- [ ] **Step 5.6: Add MCP conflict tools**
  - **Task:** Implement conflict create/list/resolve MCP tools.
  - **Files:**
    - `src/mcp/tools/create-conflict.ts` - NEW
    - `src/mcp/tools/list-conflicts.ts` - NEW
    - `src/mcp/tools/resolve-conflict.ts` - NEW
    - `src/mcp/tools/index.ts` - MODIFIED
    - `tests/mcp/conflict-tools.test.ts` - NEW
  - **Implementation:**
    - Register `create_conflict`, `list_conflicts`, and `resolve_conflict`.
    - Require at least two distinct existing conflicting record IDs.
  - **Dependencies:** Steps 3.9, 5.1
  - **Verification:** Run `npm test -- conflict-tools`; resolution archives conflict, records resolver metadata, and duplicate `conflictingRecords` IDs are rejected.

- [ ] **Step 5.7: Add MCP status, doctor, and read-only enforcement**
  - **Task:** Implement status/doctor MCP tools and prove read-only mode disables all writes.
  - **Files:**
    - `src/mcp/tools/get-status.ts` - NEW
    - `src/mcp/tools/run-doctor.ts` - NEW
    - `src/mcp/tools/index.ts` - MODIFIED
    - `tests/mcp/status-doctor-tools.test.ts` - NEW
    - `tests/mcp/read-only-mode.test.ts` - NEW
  - **Implementation:**
    - Register `get_status` and `run_doctor`.
    - In read-only mode, reject every write tool and reject `run_doctor({ fixDerivedState: true })`.
    - Treat an empty `config.defaults.allowedMcpWriteTools` list as effective MCP read-only mode for write tools while keeping read tools available.
  - **Dependencies:** Steps 3.10, 5.1
  - **Verification:** Run `npm test -- status-doctor-tools read-only-mode`; write tools fail with `BATON_MCP_READ_ONLY` under `--read-only` and under an empty `allowedMcpWriteTools` config.

### Wave 6: Status, Doctor, Fixtures, and Documentation

- [ ] **Step 6.1: Add status and doctor CLI commands**
  - **Task:** Expose core status and doctor services through `baton status` and `baton doctor`.
  - **Files:**
    - `src/cli/commands/status.ts` - NEW
    - `src/cli/commands/doctor.ts` - NEW
    - `src/cli/program.ts` - MODIFIED
    - `tests/cli/status.test.ts` - NEW
    - `tests/cli/doctor.test.ts` - NEW
  - **Implementation:**
    - Support `--json`, `--stale-after-days`, `doctor --fix`, `--yes`, and `--strict`.
    - Ensure `doctor --fix` rebuilds only derived state and missing derived folders.
  - **Dependencies:** Steps 3.10, 4.1
  - **Verification:** Run `npm test -- status doctor`; strict warnings exit `6` and fresh stores report healthy.

- [ ] **Step 6.2: Add security and corrupt-store integration tests**
  - **Task:** Add high-risk integration coverage for corrupted stores, traversal, audit behavior, and secret blocking.
  - **Files:**
    - `tests/cli/corrupt-store.test.ts` - NEW
    - `tests/cli/path-traversal.test.ts` - NEW
    - `tests/cli/audit-integration.test.ts` - NEW
    - `tests/cli/secret-scan.test.ts` - NEW
  - **Implementation:**
    - Test bad YAML, duplicate IDs, broken audit JSONL, absolute paths, sibling traversal, symlink rejection, and secret-like input.
    - Prove blocked secret writes append `secret-blocked` audit entries without source records.
  - **Dependencies:** Steps 3.2, 3.5, 3.6, 3.10, 4.2 through 4.6
  - **Verification:** Run `npm test -- corrupt-store path-traversal audit-integration secret-scan`.

- [ ] **Step 6.3: Add Claude-to-Codex demo fixture**
  - **Task:** Include a realistic local `.baton/` fixture for the primary handoff demo.
  - **Files:**
    - `fixtures/claude-to-codex-demo/.baton/config.json` - NEW
    - `fixtures/claude-to-codex-demo/.baton/.gitignore` - NEW
    - `fixtures/claude-to-codex-demo/.baton/brief.md` - NEW
    - `fixtures/claude-to-codex-demo/.baton/passes/20260523T170000Z-claude-planning.md` - NEW
    - `fixtures/claude-to-codex-demo/.baton/briefs/20260523T171500Z-route-guard-for-codex.md` - NEW
  - **Implementation:**
    - Model Claude planning, Codex-targeted brief, local-only config, and valid source-linked records.
    - Keep `index/` and `logs/` absent or regenerable to prove source files are authoritative.
  - **Dependencies:** Steps 2.3, 2.4, 2.5, 3.10
  - **Verification:** Run `baton doctor --cwd fixtures/claude-to-codex-demo --fix --yes`; fixture becomes healthy and index is regenerated.

- [ ] **Step 6.4: Add README and workflow docs**
  - **Task:** Document quickstart, first-pass workflow, targeted briefs, MCP setup, and local-first privacy.
  - **Files:**
    - `README.md` - NEW
    - `docs/first-pass-workflow.md` - NEW
    - `docs/targeted-brief-workflow.md` - NEW
    - `docs/mcp-setup.md` - NEW
    - `docs/privacy.md` - NEW
  - **Implementation:**
    - Use Baton positioning: local-first context passing, not generic memory.
    - Include `npx baton onboard`, `baton brief`, `baton brief create`, `baton pass`, `baton status`, `baton doctor`, and `baton mcp serve`.
  - **Dependencies:** Steps 4.2 through 4.6, 5.1 through 5.7, 6.1
  - **Verification:** Manually run every README quickstart command in a temp project and confirm outputs match the documented flow.

- [ ] **Step 6.5: Add agent workflow prompts and demo notes**
  - **Task:** Ship concise prompts that teach agents to read before work and pass the baton before stopping.
  - **Files:**
    - `docs/prompts/claude-planning.md` - NEW
    - `docs/prompts/codex-implementation.md` - NEW
    - `docs/prompts/review-agent.md` - NEW
    - `docs/prompts/end-of-session-pass.md` - NEW
    - `fixtures/claude-to-codex-demo/README.md` - NEW
  - **Implementation:**
    - Reference MCP tools by V1 names such as `get_brief`, `get_recent_passes`, `create_brief`, and `create_pass`.
    - Keep prompts focused on source-linked context, open questions, stale assumptions, and conflicts.
  - **Dependencies:** Steps 5.2 through 5.7, 6.3
  - **Verification:** Review prompt files for no claims about chat-history scraping, telemetry, cloud sync, semantic search, or autonomous orchestration.

- [ ] **Step 6.6: Add CI and telemetry regression guard**
  - **Task:** Add contributor CI and a test that prevents telemetry dependencies from entering Baton unnoticed.
  - **Files:**
    - `.github/workflows/ci.yml` - NEW
    - `tests/helpers/package-inspection.ts` - NEW
    - `tests/unit/no-telemetry-deps.test.ts` - NEW
  - **Implementation:**
    - Configure GitHub Actions on pull requests and main-branch pushes for Node 20 with `npm ci`, lint, type-check, build, unit tests, and e2e tests.
    - Add a denylist test for common telemetry/analytics packages and import strings such as `analytics`, `mixpanel`, `posthog`, `segment`, `sentry`, and `telemetry`.
    - Inspect `package.json`, `package-lock.json`, source files, and built output when present so the local-first/no-telemetry posture has a regression guard.
  - **Dependencies:** Steps 1.1, 1.2, 6.1
  - **Verification:** Run `npm test -- no-telemetry-deps`; CI workflow contains `npm run lint`, `npm run type-check`, `npm run build`, `npm test`, and `npm run test:e2e`.

### Final Step: End-to-End Smoke Test

- [ ] **Step 7.1: Verify Claude-to-Codex pass loop and targeted brief workflow**
  - **Task:** Add and run an end-to-end smoke test covering the complete V1 loop from onboarding through MCP retrieval.
  - **Files:**
    - `tests/e2e/claude-to-codex-smoke.test.ts` - NEW
    - `tests/e2e/local-privacy.test.ts` - NEW
    - `tests/helpers/mcp-harness.ts` - MODIFIED
    - `package.json` - MODIFIED
  - **Implementation:**
    - Create a temp project, run `baton onboard --yes`, create a pass, retrieve latest/recent passes, create/list/show a targeted brief, run status, run doctor, start MCP harness, and call `tools/list`.
    - Assert all required MCP tools are listed and no telemetry, cloud, login, hosted endpoint, or arbitrary shell capability exists.
  - **Dependencies:** Steps 1.1 through 6.6
  - **Verification:** Run `npm run lint && npm run type-check && npm run build && npm test && npm run test:e2e`; the smoke test verifies onboarding, pass creation/retrieval, targeted brief creation/retrieval, status, doctor, MCP tool listing, and local-only/no-telemetry posture.

### Future Considerations

- Hosted encrypted sync, teams, managed MCP endpoints, browser UI, Homebrew distribution, SQLite/FTS, semantic search, auto conflict detection, chat importers, review workflows, assumption-specific records, and Baton repo dogfooding files such as root `AGENTS.md` or a committed `.baton/` example remain outside V1.
