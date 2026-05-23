# Technical Specification: Baton V1 MVP

## Recommended Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | Node.js 20+ LTS | Best fit for `npx baton onboard`, broad developer availability, and MCP SDK support. |
| Language | TypeScript | Strong package ergonomics, typed schemas/interfaces, good CLI and MCP ecosystem fit. |
| CLI Framework | Commander | Small, stable, scriptable, and enough for Baton V1 without framework weight. |
| Bundler | tsup | Lightweight TypeScript bundling for a distributable npm CLI without adding framework complexity. |
| Local Storage | Human-readable Markdown files with YAML frontmatter, `config.json`, derived JSON manifest/index files | Records stay inspectable/editable. V1 uses file scans plus small derived JSON indexes to avoid native SQLite install friction. SQLite/FTS can be added later if scale requires it. |
| Schema Validation | JSON Schema + Ajv | Directly satisfies structured validation for files and MCP inputs; schemas are language-neutral. |
| MCP Server | `@modelcontextprotocol/sdk` over stdio | Aligns with Claude/Codex/Cursor-compatible local agent workflows; no hosted dependency. |
| Testing | Vitest, temp filesystem fixtures, execa-style CLI tests | Fast unit tests plus real command execution against isolated `.baton/` stores. |
| Packaging/Distribution | npm package `baton` with `bin` entry; `npx baton onboard` first | Matches product positioning and keeps install/demo path short. Homebrew can follow later. |

## Overview

Baton V1 is a local-first CLI and MCP server for passing project context between AI agents. It stores targeted briefs, session passes, decisions, and status metadata in a project-owned `.baton/` folder. The MVP focuses on one job: helping the next agent continue correctly without copy-paste, cloud sync, full chat-history ingestion, or broad agent orchestration.

## Product Principles

- Pass continuity, not generic memory.
- Local files are the source of truth.
- Agents write structured, auditable records.
- Humans can inspect and edit stored context.
- CLI first; MCP second; no web dashboard in V1.
- Store only targeted context, not whole private chats.
- Every write is attributable: actor, timestamp, source tool, record type, schema version.
- Validation should fail loudly with actionable fixes.
- Derived indexes must be rebuildable from source files.
- Features must answer: does this help the next agent continue correctly?

## Architecture Decision

Assumptions:

- Baton runs inside one project repository by default.
- The default store is `<project>/.baton/`.
- Source-of-truth records should be readable in a text editor.
- Agents may generate imperfect context, so validation, attribution, and review status matter.
- V1 should demo Claude-to-Codex handoff quickly.

Recommended architecture: a TypeScript CLI package with a local file store, shared core services, and an MCP adapter exposing the same capabilities. The CLI owns onboarding, human workflows, status, and doctor checks. The MCP server exposes constrained tools for agents to read/write Baton records inside the current project store.

Baton should not be a SaaS, dashboard, vector database, chat archive, or orchestration layer in V1. Those alternatives add trust, setup, and product complexity before the core workflow is proven. V1 should also avoid a native SQLite dependency: the expected store size is small enough for deterministic file scans, and `npx baton onboard` should work without `node-gyp`, prebuilt binary, or platform-specific install failures.

## V1 Non-Goals

- Hosted SaaS
- Login, billing, accounts, or teams
- Browser extension
- Web dashboard
- Cloud sync
- Telemetry
- Vector database
- Semantic search dependency
- Automatic chat-history scraping
- Automatic historical reconstruction
- Agent orchestration
- Arbitrary shell execution through MCP
- Plugin marketplace
- Enterprise policy controls
- Background daemon beyond explicit `baton mcp serve`

## Repository Structure

```text
.
  package.json
  tsconfig.json
  README.md
  src/
    cli/
      index.ts
      commands/
        onboard.ts
        brief.ts
        pass.ts
        decision.ts
        question.ts
        stale.ts
        conflict.ts
        status.ts
        doctor.ts
        mcp.ts
    core/
      config-service.ts
      store-service.ts
      schema-service.ts
      pass-service.ts
      brief-service.ts
      decision-service.ts
      question-service.ts
      stale-service.ts
      conflict-service.ts
      status-service.ts
      doctor-service.ts
      index-service.ts
      audit-service.ts
      secret-scan-service.ts
    mcp/
      server.ts
      tools/
        create-pass.ts
        get-latest-pass.ts
        get-recent-passes.ts
        get-brief.ts
        create-brief.ts
        list-briefs.ts
        get-targeted-brief.ts
        record-decision.ts
        get-decisions.ts
        add-open-question.ts
        get-open-questions.ts
        mark-context-stale.ts
        create-conflict.ts
        list-conflicts.ts
        resolve-conflict.ts
        get-status.ts
        run-doctor.ts
    schemas/
      config.schema.json
      project-brief.schema.json
      pass.schema.json
      brief.schema.json
      decision.schema.json
      question.schema.json
      conflict.schema.json
      audit.schema.json
      status.schema.json
      mcp-tools.schema.json
    templates/
      project-brief.md
      pass.md
      targeted-brief.md
      decision.md
      question.md
      conflict.md
    types/
      records.ts
      errors.ts
  tests/
    unit/
    cli/
    mcp/
    fixtures/
  fixtures/
    claude-to-codex-demo/
```

## Local Baton Store Layout

```text
.baton/
  .gitignore
  config.json
  brief.md
  passes/
  briefs/
  decisions/
  questions/
  conflicts/
  index/
  logs/
```

### `.gitignore`

- Purpose: keep derived and noisy local operational files out of Git by default.
- Source of truth: no.
- Manual edits: yes.
- Validation: `doctor` warns if generated ignore rules are missing but does not fail the store.
- Required V1 contents:

```gitignore
index/
logs/
```

Records are intended to be project-owned and Git-friendly by default: `config.json`, `brief.md`, `passes/`, `briefs/`, `decisions/`, `questions/`, and `conflicts/` should not be ignored unless the user chooses a private workflow.

### `config.json`

- Purpose: project-level Baton configuration.
- Source of truth: yes.
- Manual edits: yes, with schema validation.
- Validation: must match `config.schema.json`; unknown top-level fields warn in V1.

### `brief.md`

- Purpose: compact default project brief every agent can read before work.
- Source of truth: yes.
- Manual edits: yes.
- Validation: Markdown with required YAML frontmatter and required sections.

### `passes/`

- Purpose: end-of-session handoffs.
- Source of truth: yes.
- Manual edits: yes.
- Validation: each `.md` file must parse, have valid frontmatter, and include required pass sections.

### `briefs/`

- Purpose: targeted handoff briefs for specific tasks, agents, features, or timeframes.
- Source of truth: yes.
- Manual edits: yes.
- Validation: each `.md` file must satisfy `brief.schema.json`.

### `decisions/`

- Purpose: durable decision records referenced by passes, briefs, and status.
- Source of truth: yes.
- Manual edits: yes.
- Validation: each `.md` file must satisfy `decision.schema.json`.

### `questions/`

- Purpose: unresolved or answered open questions that future agents should see.
- Source of truth: yes.
- Manual edits: yes.
- Validation: each `.md` file must satisfy `question.schema.json`.

### `conflicts/`

- Purpose: explicit conflict records when agents or humans identify contradictory active context.
- Source of truth: yes.
- Manual edits: yes.
- Validation: each `.md` file must satisfy `conflict.schema.json`.

### `index/`

- Purpose: derived lookup and status data.
- Source of truth: no.
- Manual edits: no.
- Validation: can be deleted and rebuilt with `baton doctor --fix` or a later `baton index rebuild`.
- Contents: `records.json` and `manifest.json`.
- V1 rule: do not use SQLite or native dependencies. Build status and list/filter behavior from file scans plus these derived JSON files.

### `logs/`

- Purpose: append-only audit log for Baton writes and maintenance operations.
- Source of truth: operational audit, not content source.
- Manual edits: no.
- Validation: JSONL parse validation; corrupted lines are reported by `doctor`.

## Audit Log Format

Every write operation must append exactly one JSON object to `.baton/logs/audit.jsonl`. V1 uses one append-only file with no rotation; rotation can be added later if large stores need it. `doctor` validates that every non-empty line parses and matches `audit.schema.json`.

```ts
type AuditOperation =
  | "create"
  | "update"
  | "mark-stale"
  | "resolve-conflict"
  | "rebuild-index"
  | "secret-blocked"
  | "validation-failed";

interface AuditEntry {
  schemaVersion: string;
  at: string;
  operation: AuditOperation;
  result: "success" | "blocked" | "failed";
  actor: Actor;
  actorNameResolution: "cli-flag" | "git-config" | "environment" | "unknown" | "mcp-client";
  actorTypeResolution: "cli-default" | "cli-agent-flag" | "mcp-default";
  sourceTool: SourceTool;
  recordType?: RecordType;
  recordId?: string;
  recordPath?: string;
  errorCode?: string;
}
```

Audit writes must be best-effort atomic: write the record first, append audit second, and surface `BATON_AUDIT_WRITE_FAILED` if the audit append fails. `doctor` reports records missing audit entries as warnings, not corruption, because local files remain the source of truth.

## Data Model

Common supporting types. `schemaVersion` is stored as a string and validated with `^\d+\.\d+\.\d+$`; examples must quote it in YAML frontmatter.

```ts
type RecordType =
  | "config"
  | "project_brief"
  | "pass"
  | "brief"
  | "decision"
  | "question"
  | "conflict";
type ActorType = "human" | "agent" | "system";
type Confidence = "low" | "medium" | "high";
type ReviewStatus = "unreviewed" | "reviewed";
type RecordStatus = "draft" | "active" | "stale" | "superseded" | "archived";

interface Actor {
  actorType: ActorType;
  /**
   * Human-readable display name, for example "Alex" or "Codex".
   */
  name: string;
  /**
   * Stable lowercase identifier for filtering, for example "codex".
   */
  actorSlug?: string;
  modelProvider?: string;
  model?: string;
}

interface SourceTool {
  name:
    | "baton-cli"
    | "baton-mcp"
    | "claude"
    | "claude-code"
    | "codex"
    | "cursor"
    | "chatgpt"
    | "chatgpt-desktop"
    | "other";
  version?: string;
  client?: string;
}

interface SourceLink {
  kind: "file" | "url" | "commit" | "issue" | "record" | "command";
  path?: string;
  url?: string;
  recordId?: string;
  commit?: string;
  label?: string;
  lastVerifiedAt?: string;
}

interface RecordMeta {
  id: string;
  schemaVersion: string;
  recordType: RecordType;
  status: RecordStatus;
  createdAt: string;
  updatedAt?: string;
  createdBy: Actor;
  sourceTool: SourceTool;
  tags: string[];
  sourceLinks: SourceLink[];
  reviewStatus: ReviewStatus;
}
```

`updatedAt` is omitted on immutable create-only records until they are changed. Commands that rewrite a source record, such as `baton stale mark <id>` and `baton conflict resolve <id>`, must set `updatedAt` to the rewrite timestamp while preserving `createdAt`.

### Baton Config

```ts
interface RedactionRule {
  kind: "regex";
  value: string;
  flags?: string;
}

interface BatonConfig {
  schemaVersion: string;
  project: {
    name: string;
    root: string;
    defaultBranch?: string;
  };
  store: {
    path: ".baton";
    recordFormat: "markdown-yaml";
    index: {
      enabled: boolean;
      engine: "file-scan";
    };
  };
  privacy: {
    telemetry: false;
    redactPatterns: RedactionRule[];
    secretScan: boolean;
    highEntropySecretScan: boolean;
  };
  defaults: {
    staleAfterDays: number;
    allowedMcpWriteTools: string[];
  };
}
```

### Baton Pass

```ts
interface BatonPass extends RecordMeta {
  recordType: "pass";
  title: string;
  fromAgent?: string;
  toAgent?: string;
  previousPass?: string;
  currentTask: string;
  summary: string;
  changedFiles: SourceLink[];
  decisions: string[];
  blockers: string[];
  openQuestions: string[];
  staleAssumptionsFound: string[];
  nextActions: string[];
  confidence: Confidence;
}
```

### Baton Brief

```ts
interface BatonBrief extends RecordMeta {
  recordType: "brief";
  title: string;
  targetAgent: string;
  goal: string;
  scope: {
    topics: string[];
    files: string[];
    timeframe?: string;
  };
  exclusions: string[];
  relevantFiles: SourceLink[];
  designBasis: string;
  priorReasoningSummary: string;
  constraints: string[];
  openQuestions: string[];
  recommendedNextSteps: string[];
}
```

### Project Brief

```ts
interface ProjectBrief extends RecordMeta {
  recordType: "project_brief";
  projectName: string;
  currentFocus: string[];
  activeDecisions: string[];
  recentPasses: string[];
  openQuestions: string[];
  warnings: string[];
}
```

### Decision Record

```ts
interface DecisionRecord extends RecordMeta {
  recordType: "decision";
  title: string;
  decision: string;
  rationale: string;
  scope: string[];
  confidence: Confidence;
  alternativesConsidered?: string[];
  consequences?: string[];
  supersedes?: string[];
  supersededBy?: string;
}
```

### Open Question Record

```ts
interface OpenQuestionRecord extends RecordMeta {
  recordType: "question";
  title: string;
  question: string;
  context?: string;
  status: "active" | "archived";
  targetAgent?: string;
  relatedRecords: string[];
}
```

### Conflict Record

```ts
interface ConflictRecord extends RecordMeta {
  recordType: "conflict";
  title: string;
  summary: string;
  conflictingRecords: string[];
  status: "active" | "archived";
  resolution?: string;
  resolvedAt?: string;
  resolvedBy?: Actor;
}
```

### Project Status Summary

```ts
interface ProjectStatusSummary {
  schemaVersion: string;
  generatedAt: string;
  projectName: string;
  storePath: string;
  latestPass?: {
    id: string;
    title: string;
    createdAt: string;
    fromAgent?: string;
    summary: string;
    stale: boolean;
  };
  counts: {
    passes: number;
    briefs: number;
    activeDecisions: number;
    openQuestions: number;
    activeConflicts: number;
    unresolvedDecisions: number;
    staleRecords: number;
    validationIssues: number;
  };
  openBriefs: Array<{ id: string; title: string; targetAgent: string; tags: string[] }>;
  unresolvedDecisions: Array<{ id: string; title: string; status: RecordStatus }>;
  openQuestions: Array<{ id: string; title: string; targetAgent?: string; tags: string[] }>;
  activeConflicts: Array<{ id: string; title: string; conflictingRecords: string[] }>;
  warnings: BatonError[];
}
```

## File Formats

Persisted records use Markdown with YAML frontmatter. The frontmatter is schema-validated. The Markdown body is human-readable and must include required headings per record type.

### Default Project Brief

- File extension: `.md`
- Naming convention: `.baton/brief.md`
- Required frontmatter fields: `id`, `schemaVersion`, `recordType`, `status`, `projectName`, `createdAt`, `updatedAt`, `createdBy`, `sourceTool`, `tags`, `sourceLinks`, `reviewStatus`
- Required body headings: `## Current Focus`, `## Active Decisions`, `## Recent Passes`, `## Open Questions`, `## Warnings`
- Optional fields: none in V1 frontmatter; add content through the body sections.
- Example path: `.baton/brief.md`

```md
---
id: project_brief_my_app
schemaVersion: "1.0.0"
recordType: project_brief
status: active
projectName: my-app
createdAt: 2026-05-23T18:00:00Z
updatedAt: 2026-05-23T18:00:00Z
createdBy:
  actorType: human
  name: Alex
sourceTool:
  name: baton-cli
tags: []
sourceLinks: []
reviewStatus: reviewed
---

## Current Focus

- Build route guard and onboarding flow.

## Active Decisions

- Use the Next.js app router.
- Keep auth local until hosted sync exists.

## Recent Passes

- Claude planned route guard.
- Codex implemented middleware.

## Open Questions

- Should hosted sync use passkeys?

## Warnings

- 1 stale assumption: "No auth layer exists."
```

### Baton Config

- File extension: `.json`
- Naming convention: `.baton/config.json`
- Required fields: `schemaVersion`, `project`, `store`, `privacy`, `defaults`
- Optional fields: `project.defaultBranch`
- Example path: `.baton/config.json`
- Rationale: config is JSON to avoid YAML parser edge cases for settings; human-authored context records remain Markdown/YAML.

```json
{
  "schemaVersion": "1.0.0",
  "project": {
    "name": "my-app",
    "root": "/Users/example/my-app",
    "defaultBranch": "main"
  },
  "store": {
    "path": ".baton",
    "recordFormat": "markdown-yaml",
    "index": { "enabled": true, "engine": "file-scan" }
  },
  "privacy": {
    "telemetry": false,
    "redactPatterns": [
      { "kind": "regex", "value": "(api[_-]?key|secret|password|token)", "flags": "i" }
    ],
    "secretScan": true,
    "highEntropySecretScan": true
  },
  "defaults": {
    "staleAfterDays": 14,
    "allowedMcpWriteTools": [
      "create_pass",
      "create_brief",
      "record_decision",
      "add_open_question",
      "mark_context_stale",
      "create_conflict",
      "resolve_conflict"
    ]
  }
}
```

### A Baton Pass

- File extension: `.md`
- Naming convention: `.baton/passes/YYYYMMDDTHHMMSSZ-<slug>.md`
- Required fields: all `RecordMeta` fields, `title`, `currentTask`, `summary`, `nextActions`, `confidence`
- Optional fields: `previousPass`, `changedFiles`, `decisions`, `blockers`, `openQuestions`, `staleAssumptionsFound`
- Example path: `.baton/passes/20260523T183000Z-codex-route-guard.md`

```md
---
id: pass_20260523T183000Z_codex_route_guard
schemaVersion: "1.0.0"
recordType: pass
status: active
title: Codex implemented route guard
createdAt: 2026-05-23T18:30:00Z
createdBy:
  actorType: agent
  name: Codex
  actorSlug: codex
  modelProvider: openai
sourceTool:
  name: baton-mcp
  client: codex
tags: [auth, route-guard]
sourceLinks:
  - kind: file
    path: src/middleware.ts
reviewStatus: unreviewed
fromAgent: codex
toAgent: claude
currentTask: Implement route guard and prepare for review
confidence: medium
previousPass: pass_20260523T170000Z_claude_route_guard_plan
---

## Summary

Implemented the route guard middleware and left copy-review questions for Claude.

## Changed Files

- `src/middleware.ts`

## Decisions

- Keep auth local for V1.

## Blockers

- Confirm final redirect copy.

## Open Questions

- Should unauthenticated users land on `/login` or `/welcome`?

## Next Actions

- Review route copy.
- Add middleware tests.
```

### A Targeted Baton Brief

- File extension: `.md`
- Naming convention: `.baton/briefs/YYYYMMDDTHHMMSSZ-<slug>-for-<agent>.md`
- Required fields: `RecordMeta`, `title`, `targetAgent`, `goal`, `scope`, `exclusions`, `designBasis`, `priorReasoningSummary`
- Optional fields: `timeframe`, `openQuestions`, `recommendedNextSteps`
- Required body headings: `## Goal For <Target Agent>`, `## Relevant Background`, `## Prior Reasoning Summary`, `## Design Basis`, `## Important Decisions`, `## Relevant Files And Sources`, `## Known Pitfalls`, `## Open Questions`, `## Recommended Next Steps`
- Example path: `.baton/briefs/20260523T184000Z-march-training-feature-for-codex.md`

```md
---
id: brief_20260523T184000Z_march_training_feature
schemaVersion: "1.0.0"
recordType: brief
status: active
title: March training feature implementation basis
createdAt: 2026-05-23T18:40:00Z
createdBy:
  actorType: human
  name: Alex
sourceTool:
  name: baton-cli
tags: [training, march, implementation]
sourceLinks:
  - kind: file
    path: docs/march-training-notes.md
reviewStatus: reviewed
targetAgent: codex
goal: Modify the March training feature without revisiting unrelated project history.
scope:
  topics: [training module, skill files, design basis]
  files: [src/training, skills]
  timeframe: March 2026
exclusions:
  - Billing work
  - Unrelated onboarding UI
---

## Goal For Codex

Enhance the March training feature using the existing design basis.

## Relevant Background

The feature was scoped in March and should stay aligned with the existing training flow.

## Prior Reasoning Summary

Claude narrowed the implementation basis to the March training feature and excluded unrelated onboarding and billing history.

## Design Basis

Use the existing module structure. Do not introduce a parallel training model.

## Important Decisions

- Preserve the current training route shape.
- Keep skill-file parsing local.

## Relevant Files And Sources

- `src/training`
- `skills`
- `docs/march-training-notes.md`

## Known Pitfalls

- Do not mix March training assumptions with newer onboarding work.

## Open Questions

- Confirm whether legacy fixtures still need support.

## Recommended Next Steps

- Inspect current parser behavior.
- Add focused tests before refactoring.
```

### A Decision Record

- File extension: `.md`
- Naming convention: `.baton/decisions/YYYYMMDDTHHMMSSZ-<slug>.md`
- Required fields: `RecordMeta`, `title`, `decision`, `rationale`, `scope`, `confidence`
- Optional fields: `alternativesConsidered`, `supersedes`, `supersededBy`, `consequences`
- Example path: `.baton/decisions/20260523T185000Z-use-markdown-yaml-records.md`

```md
---
id: decision_20260523T185000Z_markdown_yaml_records
schemaVersion: "1.0.0"
recordType: decision
status: active
title: Use Markdown plus YAML frontmatter for records
createdAt: 2026-05-23T18:50:00Z
createdBy:
  actorType: human
  name: Alex
sourceTool:
  name: baton-cli
tags: [storage, architecture]
sourceLinks: []
reviewStatus: reviewed
confidence: high
scope: [local-store, v1]
supersedes: []
---

## Decision

Baton V1 stores passes, briefs, and decisions as Markdown files with YAML frontmatter.

## Rationale

Records remain readable and editable while still supporting schema validation.

## Alternatives Considered

- JSON-only records
- SQLite source of truth

## Consequences

- The parser must validate both metadata and required body sections.
- The index can always be rebuilt from files.
```

### An Open Question Record

- File extension: `.md`
- Naming convention: `.baton/questions/YYYYMMDDTHHMMSSZ-<slug>.md`
- Required fields: `RecordMeta`, `title`, `question`, `status`, `relatedRecords`
- Optional fields: `context`, `targetAgent`
- Example path: `.baton/questions/20260523T190000Z-auth-redirect-target.md`

### A Conflict Record

- File extension: `.md`
- Naming convention: `.baton/conflicts/YYYYMMDDTHHMMSSZ-<slug>.md`
- Required fields: `RecordMeta`, `title`, `summary`, `conflictingRecords`, `status`
- Optional fields: `resolution`, `resolvedAt`, `resolvedBy`
- Example path: `.baton/conflicts/20260523T191000Z-local-store-format.md`

## Schema Validation

- Schema location: `src/schemas/*.schema.json`, packaged with the CLI.
- Validation library: Ajv in strict mode.
- Runtime validation behavior:
  - All writes validate before saving.
  - All reads validate before returning data to CLI or MCP.
  - `brief.md` validates against `project-brief.schema.json`.
  - `audit.jsonl` validates line-by-line against `audit.schema.json`.
  - `doctor` validates every file in `.baton/`.
  - Invalid records are excluded from normal status/search unless `--include-invalid` is added later.
- Path validation behavior: all file-reference inputs follow the Path Safety rules in Security and Privacy.
- Error format: structured `BatonError` objects with code, message, path, field, severity, and recovery guidance.
- Schema versions:
  - V1 writes `schemaVersion: "1.0.0"`.
  - YAML examples must quote `schemaVersion`.
  - Parsers may coerce scalar schema versions to strings before validation.
  - Patch/minor-compatible versions may warn.
  - Major mismatches fail validation.
- Tag rules:
  - Tags are lowercase kebab-case strings matching `^[a-z0-9][a-z0-9-]{0,63}$`.
  - Duplicate tags are removed during write normalization.
  - Invalid tags fail validation.
- Migration posture:
  - No automatic destructive migrations in V1.
  - Future `baton migrate` may rewrite records after backup.
  - `doctor` may recommend migration but must not alter source records unless explicitly requested.

## CLI Specification

Global flags:

```text
--cwd <path>          Project root, default current working directory
--store <path>        Baton store path, default .baton
--json                Machine-readable output
--quiet               Suppress non-error text
--no-color            Disable color
--actor <name>        Display name for the writer; does not set actor type
--agent <name>        Mark a CLI write as agent-authored and unreviewed
--source-tool <name>  Tool creating the record
```

Actor identity rules:

- `baton-cli` writes default to `actorType: "human"`.
- `baton-mcp` writes default to `actorType: "agent"`.
- `--actor` sets only the display name.
- `--agent` on CLI writes sets `actorType: "agent"` and `reviewStatus: "unreviewed"`.
- If `--actor` is omitted, resolve the display name from `git config user.name`, then `$USER` or `$USERNAME`, then `"unknown"`.
- Audit entries must record separate actor display-name and actor-type resolution sources.

Exit codes:

```text
0 success
1 validation or user input error
2 Baton store not found
3 corrupted store or unparsable record
4 MCP startup/runtime error
5 security or permission error
6 store warning in strict mode
10 unexpected internal error
```

### `baton onboard`

- Purpose: initialize `.baton/`.
- Usage: `baton onboard [--name <project>] [--yes] [--mcp <client>] [--json]`
- Flags/options:
  - `--name <project>`
  - `--yes`
  - `--mcp claude-desktop|claude-code|codex|cursor|chatgpt-desktop|none`
  - `--force` only to repair missing starter files, never overwrite records silently
- Interactive behavior: detects Git root, asks whether to create `.baton/`, starter brief, `.baton/.gitignore`, and optional MCP config instructions.
- Non-interactive behavior: `--yes` creates default config and starter files.
- Output format: human summary or JSON object with created paths.
- MCP setup behavior:
  - For `claude-desktop` and `cursor`, Baton may update known local MCP config files only after explicit confirmation.
  - For `claude-code`, `codex`, and `chatgpt-desktop`, V1 may print copy-pasteable configuration instructions instead of mutating config files, because client config locations may vary.
  - All MCP setup output must include the equivalent `baton mcp serve --store <path>` command.
- Existing store behavior: a complete existing store is left unchanged; without `--force`, onboarding exits with an already-initialized message. With `--force`, onboarding may repair missing folders and starter files, but V1 must not migrate schemas or rewrite existing source records silently.
- Error cases: partial store without `--force`, root not writable, invalid project name, MCP config path unsupported.
- Exit codes: `0`, `1`, `5`, `10`.
- Example invocation: `npx baton onboard --name my-app --yes`

### `baton brief`

- Purpose: show compact default project brief.
- Usage: `baton brief [--json]`
- Flags/options: `--json`
- Interactive behavior: none.
- Non-interactive behavior: prints brief and warnings.
- Output format: Markdown/text or JSON.
- Error cases: store missing, brief missing, `project-brief.schema.json` validation failed.
- Exit codes: `0`, `2`, `3`.
- Example invocation: `baton brief`

### `baton pass`

- Purpose: create an end-of-session handoff.
- Usage: `baton pass [options]`
- Flags/options:
  - `--from <agent>`
  - `--to <agent>`
  - `--title <title>`
  - `--task <text>`
  - `--summary <text>`
  - `--previous-pass <id>`
  - `--file <path>` repeatable
  - `--decision <text>` repeatable
  - `--blocker <text>` repeatable
  - `--question <text>` repeatable
  - `--next <text>` repeatable
  - `--tag <tag>` repeatable
  - `--confidence low|medium|high`
  - `--stdin` read JSON input
  - `--editor` open `$EDITOR`
- Interactive behavior: prompts exactly for: what changed, what decisions were made, what remains open, which files or sources matter, stale assumptions found, next recommended actions, and confidence.
- Non-interactive behavior: flags or `--stdin` must provide required fields. `--confidence` defaults to `medium` if omitted and records a warning in JSON output.
- Output format: created pass ID/path plus warnings; JSON if requested.
- Error cases: missing required fields, invalid file reference, path outside project root, secret detected, schema invalid, write denied.
- Exit codes: `0`, `1`, `2`, `5`.
- Example invocation: `baton pass --from codex --summary "Implemented route guard" --task "Auth middleware" --file src/middleware.ts --next "Review copy" --confidence medium`

### `baton brief create`

- Purpose: create a targeted brief.
- Usage: `baton brief create [options]`
- Flags/options:
  - `--title <title>`
  - `--to <agent>`
  - `--goal <text>`
  - `--topic <topic>` repeatable
  - `--file <path>` repeatable
  - `--exclude <text>` repeatable
  - `--tag <tag>` repeatable
  - `--slug <slug>`
  - `--stdin` read Markdown body or structured JSON
  - `--editor` open `$EDITOR`
- Interactive behavior: prompts for title, target agent, goal, scope, exclusions, content sections.
- Non-interactive behavior: required fields supplied through flags/stdin.
- Output format: brief ID/path; JSON if requested.
- Error cases: missing target agent, missing goal, invalid scope path, path outside project root, secret detected, schema invalid. Slug collisions auto-suffix with `-2`, `-3`, etc. unless `--slug` is supplied, in which case collision is an error.
- Exit codes: `0`, `1`, `2`, `5`.
- Example invocation: `baton brief create --title "March training feature" --to codex --goal "Implement March training updates" --file src/training --exclude "Billing"`

### `baton brief list`

- Purpose: list targeted briefs.
- Usage: `baton brief list [--tag <tag>] [--to <agent>] [--status <status>] [--since <date>] [--json]`
- Flags/options: `--tag`, `--to`, `--status`, `--since`, `--limit`, `--json`
- Interactive behavior: none.
- Non-interactive behavior: prints table/JSON.
- Output format: ID, title, target agent, tags, status, created date.
- Error cases: store missing, index corrupt with failed file-scan fallback.
- Exit codes: `0`, `2`, `3`.
- Example invocation: `baton brief list --to codex --tag training`

### `baton brief show <id>`

- Purpose: show a targeted brief by ID or slug.
- Usage: `baton brief show <id> [--json] [--metadata]`
- Flags/options: `--json`, `--metadata`
- Interactive behavior: none.
- Non-interactive behavior: exact deterministic lookup.
- Output format: Markdown by default; JSON if requested. `--metadata` includes validated frontmatter before the Markdown body.
- Error cases: not found, invalid record.
- Exit codes: `0`, `1`, `2`, `3`.
- Example invocation: `baton brief show march-training-feature`

### `baton decision add`

- Purpose: create a decision record that future agents should treat as project context.
- Usage: `baton decision add [--title <title>] [--decision <text>] [--rationale <text>] [--scope <scope>] [--confidence low|medium|high] [--tag <tag>] [--editor] [--json]`
- Flags/options:
  - `--title <title>`
  - `--decision <text>`
  - `--rationale <text>`
  - `--scope <scope>` repeatable
  - `--confidence low|medium|high`
  - `--tag <tag>` repeatable
  - `--editor`
  - `--stdin`
- Interactive behavior: prompts for title, decision, rationale, affected scope, confidence, and source links.
- Non-interactive behavior: required fields supplied through flags/stdin. `--confidence` defaults to `medium`.
- Output format: decision ID/path; JSON if requested.
- Error cases: missing decision, path outside project root, secret detected, schema invalid, write denied.
- Exit codes: `0`, `1`, `2`, `5`.
- Example invocation: `baton decision add --title "Use file-scan index for V1" --decision "Avoid SQLite in V1" --rationale "Keep npx install reliable" --scope storage --confidence high`

### `baton decision list`

- Purpose: list active, stale, superseded, or archived decisions.
- Usage: `baton decision list [--status active|stale|superseded|archived] [--tag <tag>] [--since <date>] [--json]`
- Flags/options: `--status`, `--tag`, `--since`, `--limit`, `--json`
- Interactive behavior: none.
- Non-interactive behavior: prints table/JSON.
- Output format: ID, title, status, confidence, tags, created date.
- Error cases: store missing, invalid decision record.
- Exit codes: `0`, `2`, `3`.
- Example invocation: `baton decision list --status active`

### `baton question add`

- Purpose: record an unresolved open question.
- Usage: `baton question add [--title <title>] [--question <text>] [--to <agent>] [--tag <tag>] [--json]`
- Flags/options: `--title`, `--question`, `--to`, `--tag`, `--file`, `--record`, `--stdin`, `--editor`, `--json`
- Interactive behavior: prompts for the question, context, target agent if any, related files, and related records.
- Non-interactive behavior: required fields supplied through flags/stdin.
- Output format: question ID/path; JSON if requested.
- Error cases: missing question, invalid related record, path outside project root, secret detected, schema invalid.
- Exit codes: `0`, `1`, `2`, `5`.
- Example invocation: `baton question add --title "Auth redirect target" --question "Should unauthenticated users land on /login or /welcome?" --to claude --tag auth`

### `baton question list`

- Purpose: list unresolved open questions.
- Usage: `baton question list [--to <agent>] [--tag <tag>] [--since <date>] [--json]`
- Flags/options: `--to`, `--tag`, `--since`, `--limit`, `--json`
- Interactive behavior: none.
- Non-interactive behavior: prints table/JSON.
- Output format: ID, title, target agent, tags, created date.
- Error cases: store missing, invalid question record.
- Exit codes: `0`, `2`, `3`.
- Example invocation: `baton question list --to claude`

### `baton stale mark <id>`

- Purpose: mark an existing record stale so future agents do not treat it as active context.
- Usage: `baton stale mark <id> [--reason <text>] [--json]`
- Flags/options: `--reason`, `--json`
- Interactive behavior: prompts for reason if omitted.
- Non-interactive behavior: requires `--reason` unless `--json` stdin supplies it.
- Output format: updated record ID/path and audit event ID; JSON if requested.
- Error cases: record not found, default project brief, record already archived, schema rewrite failed, audit append failed.
- No-op behavior: records already marked `stale` or `superseded` remain unchanged and return a warning instead of rewriting the record.
- Exit codes: `0`, `1`, `2`, `3`, `5`.
- Example invocation: `baton stale mark decision_20260523T185000Z_markdown_yaml_records --reason "Superseded by file-scan V1 decision"`

### `baton conflict add`

- Purpose: create a basic conflict record when two or more active records contradict each other.
- Usage: `baton conflict add [--title <title>] [--summary <text>] [--record <id>]... [--json]`
- Flags/options: `--title`, `--summary`, `--record` repeatable, `--tag`, `--stdin`, `--editor`, `--json`
- Interactive behavior: prompts for title, summary, and conflicting record IDs.
- Non-interactive behavior: requires summary and at least two distinct `--record` values.
- Output format: conflict ID/path; JSON if requested.
- Error cases: missing records, fewer than two distinct records, duplicate record references, schema invalid, write denied.
- Exit codes: `0`, `1`, `2`, `5`.
- Example invocation: `baton conflict add --title "Storage source of truth" --summary "One note says SQLite source of truth; another says Markdown source of truth." --record decision_a --record pass_b`

### `baton conflict list`

- Purpose: list active or resolved conflict records.
- Usage: `baton conflict list [--status active|archived] [--tag <tag>] [--json]`
- Flags/options: `--status`, `--tag`, `--limit`, `--json`
- Interactive behavior: none.
- Non-interactive behavior: prints table/JSON.
- Output format: ID, title, status, conflicting records, created date.
- Error cases: store missing, invalid conflict record.
- Exit codes: `0`, `2`, `3`.
- Example invocation: `baton conflict list --status active`

### `baton conflict resolve <id>`

- Purpose: resolve a conflict record without deleting its history.
- Usage: `baton conflict resolve <id> [--resolution <text>] [--json]`
- Flags/options: `--resolution`, `--json`
- Interactive behavior: prompts for resolution if omitted.
- Non-interactive behavior: requires `--resolution`.
- Output format: updated conflict ID/path and audit event ID; JSON if requested.
- Error cases: conflict not found, already archived, schema rewrite failed, audit append failed.
- Exit codes: `0`, `1`, `2`, `3`, `5`.
- Example invocation: `baton conflict resolve conflict_20260523T191000Z_local_store_format --resolution "Markdown/YAML source files are authoritative; index is derived."`

### `baton status`

- Purpose: summarize current Baton project state.
- Usage: `baton status [--json] [--stale-after-days <n>]`
- Flags/options: `--json`, `--stale-after-days`
- Interactive behavior: none.
- Non-interactive behavior: CI-safe summary.
- Output format: human summary or `ProjectStatusSummary`.
- Error cases: store missing, config invalid, validation issues.
- Exit codes: `0` if usable, `6` if validation warnings in strict CI mode, `2`, `3`.
- Example invocation: `baton status --json`

### `baton doctor`

- Purpose: validate and repair safe derived store state.
- Usage: `baton doctor [--json] [--fix] [--yes] [--strict]`
- Flags/options:
  - `--fix` rebuilds index and creates missing derived folders only
  - `--yes` applies safe fixes without prompting when used with `--fix`
  - `--strict` treats warnings as failures
  - `--json`
- Interactive behavior: asks before safe fixes unless `--fix --yes`.
- Non-interactive behavior: returns structured diagnostics.
- Output format: checks, severity, affected path, suggested fix.
- Error cases: config invalid, corrupted records, index rebuild failed, permission denied.
- Exit codes: `0` healthy, `6` warnings in strict mode, `1` unhealthy, `2` missing store, `3` corrupted store, `5` permission.
- Example invocation: `baton doctor --fix`

### `baton mcp serve`

- Purpose: start the local MCP server.
- Usage: `baton mcp serve [--store <path>] [--read-only] [--default-actor <name>]`
- Flags/options:
  - `--read-only`
  - `--default-actor <name>`
  - `--log-file <path>`
- Interactive behavior: none; MCP runs over stdio.
- Non-interactive behavior: required for agent clients.
- Output format: MCP protocol messages only on stdio; logs go to stderr/file.
- Error cases: store missing, config invalid, MCP initialization failed, write tool disabled.
- Exit codes: `0`, `2`, `3`, `4`, `5`.
- Example invocation: `baton mcp serve --read-only`

## MCP Tool Specification

All MCP tools are scoped to the resolved `.baton/` store. They must reject path traversal, arbitrary filesystem access, broad project file reads, and shell execution. Tool `inputSchema` values must be real JSON Schemas, not free-text descriptions. MCP writes follow the actor trust rules in Security and Privacy, and write tools are disabled when `baton mcp serve --read-only` is active. If `config.defaults.allowedMcpWriteTools` is empty, the MCP server still starts and read tools work, but all write tools behave as disabled and return `BATON_MCP_READ_ONLY`.

### `get_brief`

- Purpose: return the default project brief from `.baton/brief.md`; this is the cold-start tool agents should call before work.
- Input schema: `{ includeMarkdown?: boolean }`
- Output schema: `{ brief: ProjectBrief, markdown?: string, statusCounts: ProjectStatusSummary["counts"], warnings: BatonError[] }`
- Read/write behavior: read.
- Security boundaries: reads only `.baton/brief.md` and derived status counts.
- Failure modes: store missing, project brief missing, `project-brief.schema.json` validation failed.

### `create_pass`

- Purpose: write a Baton Pass.
- Input schema: `{ actorName?: string, title: string, fromAgent?: string, toAgent?: string, previousPass?: string, currentTask: string, summary: string, changedFiles?: SourceLink[], decisions?: string[], blockers?: string[], openQuestions?: string[], staleAssumptionsFound?: string[], nextActions: string[], confidence?: Confidence, tags?: string[] }`
- Output schema: `{ id: string, path: string, createdAt: string, warnings: BatonError[] }`
- Read/write behavior: write.
- Security boundaries: can only create files under `.baton/passes/`; all file paths must be relative and resolve under `config.project.root`.
- Failure modes: store missing, schema invalid, read-only mode, source path outside project, secret detected, audit write failed, write failed.

### `get_latest_pass`

- Purpose: retrieve most recent valid active pass.
- Input schema: `{ targetAgent?: string, maxAgeDays?: number, includeMarkdown?: boolean }`
- Output schema: `{ pass: BatonPass | null, markdown?: string, stale: boolean, warnings: BatonError[] }`
- Read/write behavior: read.
- Security boundaries: reads only `.baton/passes/`.
- Failure modes: no passes, invalid latest pass, store missing.

### `get_recent_passes`

- Purpose: retrieve recent valid active passes for cold-start continuation.
- Input schema: `{ limit?: number, sinceDays?: number, fromAgent?: string, targetAgent?: string, includeMarkdown?: boolean }`
- Output schema: `{ passes: Array<{ pass: BatonPass, markdown?: string, stale: boolean }>, warnings: BatonError[] }`
- Read/write behavior: read.
- Security boundaries: reads only `.baton/passes/`.
- Failure modes: store missing, invalid records skipped with warnings.
- Defaults: `limit` defaults to `3` and must be between `1` and `10`.

### `create_brief`

- Purpose: write a targeted brief.
- Input schema: `{ actorName?: string, title: string, targetAgent: string, goal: string, scope: { topics: string[], files: string[], timeframe?: string }, exclusions: string[], relevantFiles?: SourceLink[], designBasis: string, priorReasoningSummary: string, constraints?: string[], openQuestions?: string[], recommendedNextSteps?: string[], tags?: string[] }`
- Output schema: `{ id: string, path: string, createdAt: string, warnings: BatonError[] }`
- Read/write behavior: write.
- Security boundaries: can only create files under `.baton/briefs/`; all file paths must be relative and resolve under `config.project.root`.
- Failure modes: schema invalid, missing target agent, duplicate explicit slug, source path outside project, read-only mode, secret detected, audit write failed.

### `list_briefs`

- Purpose: list targeted briefs by filters.
- Input schema: `{ targetAgent?: string, tags?: string[], status?: RecordStatus, since?: string, limit?: number }`
- Output schema: `{ briefs: Array<{ id: string, title: string, goal: string, targetAgent: string, tags: string[], status: RecordStatus, createdAt: string }> }`
- Read/write behavior: read.
- Security boundaries: reads only `.baton/briefs/` and derived index files.
- Failure modes: invalid record skipped with warning.

### `get_targeted_brief`

- Purpose: read a targeted brief by ID or slug.
- Input schema: `{ id: string, includeMarkdown?: boolean }`
- Output schema: `{ brief: BatonBrief, markdown?: string, warnings: BatonError[] }`
- Read/write behavior: read.
- Security boundaries: no arbitrary path input; ID/slug lookup only.
- Failure modes: not found, invalid record.

### `record_decision`

- Purpose: create a decision record.
- Input schema: `{ actorName?: string, title: string, decision: string, rationale: string, scope: string[], confidence?: Confidence, tags?: string[], sourceLinks?: SourceLink[] }`
- Output schema: `{ id: string, path: string, createdAt: string, warnings: BatonError[] }`
- Read/write behavior: write.
- Security boundaries: writes only `.baton/decisions/`; file source links must stay under project root.
- Failure modes: schema invalid, read-only mode, source path outside project, secret detected, audit write failed.

### `get_decisions`

- Purpose: list decision records for current project context.
- Input schema: `{ status?: RecordStatus, tags?: string[], since?: string, limit?: number }`
- Output schema: `{ decisions: Array<{ id: string, title: string, decision: string, status: RecordStatus, confidence: Confidence, tags: string[], createdAt: string }> }`
- Read/write behavior: read.
- Security boundaries: reads only `.baton/decisions/`.
- Failure modes: store missing, invalid record skipped with warning.

### `add_open_question`

- Purpose: create an open question record.
- Input schema: `{ actorName?: string, title: string, question: string, context?: string, targetAgent?: string, relatedRecords?: string[], tags?: string[], sourceLinks?: SourceLink[] }`
- Output schema: `{ id: string, path: string, createdAt: string, warnings: BatonError[] }`
- Read/write behavior: write.
- Security boundaries: writes only `.baton/questions/`; source links must stay under project root.
- Failure modes: schema invalid, related record not found, read-only mode, source path outside project, secret detected.

### `get_open_questions`

- Purpose: list unresolved open questions.
- Input schema: `{ targetAgent?: string, tags?: string[], since?: string, limit?: number }`
- Output schema: `{ questions: Array<{ id: string, title: string, question: string, targetAgent?: string, tags: string[], createdAt: string }> }`
- Read/write behavior: read.
- Security boundaries: reads only `.baton/questions/`.
- Failure modes: store missing, invalid record skipped with warning.

### `mark_context_stale`

- Purpose: mark an existing record stale.
- Input schema: `{ actorName?: string, id: string, reason: string }`
- Output schema: `{ id: string, path: string, status: "stale", auditWritten: boolean, warnings: BatonError[] }`
- Read/write behavior: write.
- Security boundaries: may update only Baton source records inside `.baton/`; cannot modify config, logs, or derived index files.
- Failure modes: record not found, default project brief, record archived, read-only mode, schema rewrite failed, audit write failed.

### `create_conflict`

- Purpose: create a basic conflict record.
- Input schema: `{ actorName?: string, title: string, summary: string, conflictingRecords: string[], tags?: string[], sourceLinks?: SourceLink[] }`
- Output schema: `{ id: string, path: string, createdAt: string, warnings: BatonError[] }`
- Read/write behavior: write.
- Input validation: `conflictingRecords` must contain at least two distinct record IDs.
- Security boundaries: writes only `.baton/conflicts/`.
- Failure modes: fewer than two distinct records, duplicate record references, referenced record not found, read-only mode, schema invalid, secret detected.

### `list_conflicts`

- Purpose: list active or archived conflict records.
- Input schema: `{ status?: "active" | "archived", tags?: string[], limit?: number }`
- Output schema: `{ conflicts: Array<{ id: string, title: string, summary: string, status: string, conflictingRecords: string[], createdAt: string }> }`
- Read/write behavior: read.
- Security boundaries: reads only `.baton/conflicts/`.
- Failure modes: invalid record skipped with warning.

### `resolve_conflict`

- Purpose: archive a conflict record with a resolution.
- Input schema: `{ actorName?: string, id: string, resolution: string }`
- Output schema: `{ id: string, path: string, status: "archived", resolvedAt: string, warnings: BatonError[] }`
- Read/write behavior: write.
- Security boundaries: may update only `.baton/conflicts/` records.
- Failure modes: conflict not found, read-only mode, schema rewrite failed, audit write failed.

### `get_status`

- Purpose: return current Baton status summary.
- Input schema: `{ includeWarnings?: boolean }`
- Output schema: `ProjectStatusSummary`
- Read/write behavior: read.
- Security boundaries: reads only store files.
- Failure modes: store missing, config invalid, corrupted records.

### `run_doctor`

- Purpose: validate Baton store.
- Input schema: `{ strict?: boolean, fixDerivedState?: boolean }`
- Output schema: `{ healthy: boolean, checks: DoctorCheck[], errors: BatonError[] }`
- Read/write behavior: read by default; may rebuild `index/` only when `fixDerivedState` is true and the server is not in read-only mode.
- Security boundaries: cannot modify source records.
- Failure modes: permission denied, corrupted files, schema mismatch, read-only mode with `fixDerivedState: true`.

## Core Services

| Service | File path | Inputs | Outputs | Key functions | Error handling |
|---------|-----------|--------|---------|---------------|----------------|
| Config service | `src/core/config-service.ts` | cwd/store path | `BatonConfig` | resolve store, read config, write initial config | `STORE_NOT_FOUND`, `CONFIG_INVALID` |
| Store service | `src/core/store-service.ts` | record type, paths | parsed records/files | canonicalize paths, atomic write, file scan | `PATH_OUTSIDE_STORE`, `WRITE_FAILED` |
| Schema validation service | `src/core/schema-service.ts` | object/schema ID | validated data | load schemas, validate records, format errors | `SCHEMA_INVALID`, `UNSUPPORTED_SCHEMA_VERSION` |
| Pass service | `src/core/pass-service.ts` | pass input | `BatonPass` | create pass, list passes, get latest pass | validation/security errors |
| Brief service | `src/core/brief-service.ts` | brief input/filter | `BatonBrief` records | create/list/get targeted briefs | not found, ambiguous ID |
| Decision service | `src/core/decision-service.ts` | decision input/filter | decisions/status refs | create decisions, parse decisions, list active decisions, detect supersession | invalid records |
| Question service | `src/core/question-service.ts` | question input/filter | open question records | create/list open questions | invalid records |
| Conflict service | `src/core/conflict-service.ts` | conflict input/filter | conflict records | create/list/resolve conflicts | invalid records, missing related records |
| Stale service | `src/core/stale-service.ts` | record ID/reason | updated source record | mark records stale, preserve audit trail | missing records, invalid rewrites |
| Status service | `src/core/status-service.ts` | store records | `ProjectStatusSummary` | compute counts, stale records, latest pass, questions, conflicts | degraded output with warnings |
| Doctor service | `src/core/doctor-service.ts` | store path/config | diagnostics | validate structure, schemas, derived indexes, links, secrets, symlinks | severity-coded diagnostics |
| MCP adapter | `src/mcp/server.ts` | MCP requests | MCP responses | register tools, enforce read-only/write policy | MCP errors wrapping `BatonError` |
| CLI adapter | `src/cli/index.ts` | argv/stdin | stdout/stderr/exit code | parse commands, call services, format output | maps `BatonError` to CLI output |

## Baton Pass Behavior

A pass is created when a human or agent ends a work session.

Creation flow:

1. Resolve project root and `.baton/`.
2. Collect required fields from flags, stdin, MCP input, or prompts.
3. Generate ID and filename from timestamp and title.
4. Attach metadata: actor, timestamp, source tool, schema version, record type.
5. Validate that file references are relative and resolve under project root.
6. Run secret scan over metadata and Markdown body.
7. Validate against `pass.schema.json`.
8. Write atomically to `.baton/passes/`.
9. Append exactly one audit event to `.baton/logs/audit.jsonl`.
10. Update or rebuild derived index.

If generated IDs or filenames collide at write time, append `-2`, `-3`, and so on to the generated slug portion before writing.

Required fields:

- `title`
- `currentTask`
- `summary`
- `nextActions`
- `confidence`
- common record metadata

Optional fields:

- `fromAgent`
- `toAgent`
- `previousPass`
- `changedFiles`
- `decisions`
- `blockers`
- `openQuestions`
- `staleAssumptionsFound`
- `tags`

Human-authored behavior:

- Interactive prompts are available.
- Review status defaults to `reviewed` for CLI writes unless `--agent` is used.

Agent-authored behavior:

- MCP or non-interactive CLI input is expected.
- Review status defaults to `unreviewed`.
- `--agent` on CLI and all MCP write tools produce unreviewed records.

Latest-pass resolution:

- Use newest valid active pass by `createdAt`.
- If tied, sort by filename.
- Ignore archived/superseded passes.
- Invalid latest records are reported by `doctor` and skipped by `get_latest_pass` with warning.

Staleness detection:

- A pass is stale if older than `config.defaults.staleAfterDays`.
- A pass may be stale if referenced source files no longer exist.
- Future versions may compare file hashes; V1 only validates existence and age.

## Baton Brief Behavior

A targeted brief is a durable, scoped handoff for a specific future task or agent. It differs from a pass because it is deliberate task packaging, not an end-of-session summary.

Creation:

- Human: `baton brief create` prompts or opens editor.
- Agent: MCP `create_brief` writes structured content supplied by the agent.
- Baton does not automatically reconstruct historical context in V1.

Scope declaration:

- `scope.topics`
- `scope.files`
- optional `scope.timeframe`

Exclusions declaration:

- `exclusions` is required and must state what not to include or rely on.
- Empty exclusions are allowed only if explicitly set to `[]`.

Relevant files:

- Stored as source links or scope file paths.
- Baton references files; it does not silently ingest file contents.
- A future `--include-file-content` feature is out of V1 unless explicitly added.

Historical reasoning:

- The creating human/agent summarizes prior reasoning in `priorReasoningSummary` and separately states the design basis in `designBasis`.
- Baton validates and stores the summary but does not judge correctness.

Retrieval:

- Humans use `baton brief list` and `baton brief show <id>`.
- Agents use `list_briefs` and `get_targeted_brief`.
- ID lookup supports exact ID or slug. Prefix matching is deferred to avoid ambiguous V1 behavior.

## Decision, Question, Stale, and Conflict Behavior

These records are intentionally thin in V1. They exist to satisfy the project continuity loop and context-health promise, not to become a project management system.

Decision records:

- Created with `baton decision add` or MCP `record_decision`.
- Stored under `.baton/decisions/`.
- Included in `baton brief`, `baton status`, and `get_status`.
- Agent-authored decisions default to `reviewStatus: "unreviewed"`.
- V1 does not require a separate review workflow; review state is metadata for humans and future tooling.

Open questions:

- Created with `baton question add` or MCP `add_open_question`.
- Listed with `baton question list` or MCP `get_open_questions`.
- Included in status counts and default project brief warnings.
- A question is unresolved while `status: "active"` and is removed from active lists when archived.

Stale marking:

- `baton stale mark <id>` and MCP `mark_context_stale` update an existing Baton source record to `status: "stale"`.
- The default project brief cannot be marked stale; edit `.baton/brief.md` directly instead.
- Records already marked `stale` or `superseded` are treated as no-ops with warnings, not rewritten.
- The command must preserve the original file, update `updatedAt`, append a short stale reason to the Markdown body, and write an audit entry.
- Stale marking is not deletion; stale records remain inspectable and can be used for provenance.

Conflict records:

- Created with `baton conflict add` or MCP `create_conflict` when two or more active records appear contradictory.
- All `conflictingRecords` IDs must be distinct.
- Listed with `baton conflict list` or MCP `list_conflicts`.
- Resolved with `baton conflict resolve <id>` or MCP `resolve_conflict`, which archives the conflict and records the resolution.
- V1 conflict detection is manual or agent-submitted. Automatic contradiction detection is future work.

## Status and Doctor Behavior

`baton status` reports:

- Project name and store path
- Latest pass
- Open targeted briefs
- Active and unresolved decisions
- Open questions
- Active conflicts
- Stale handoffs
- Validation issue count
- Store health warnings

`baton doctor` validates:

- `.baton/` exists
- Required folders exist
- `config.json` is valid
- Markdown/YAML records parse
- Schemas pass
- IDs are unique
- Source file references resolve where possible
- Index is current or rebuildable
- Audit log is parseable
- Secret patterns are not obviously present
- MCP write tools match config
- Symlinks inside `.baton/` are rejected
- Source-link paths are relative and resolve under project root
- `.baton/.gitignore` ignores `index/` and `logs/`

Store states:

- Healthy: config valid, records valid, index rebuildable, no critical issues.
- Stale: records are valid but old or source links are missing.
- Invalid: schema validation fails.
- Corrupted: files cannot parse, duplicate IDs exist, or index/log state cannot be read.

Suggested fix output:

```text
[error] RECORD_SCHEMA_INVALID .baton/passes/20260523T183000Z-codex-route-guard.md
Field: confidence
Fix: Set confidence to one of low, medium, high.

[warn] INDEX_STALE .baton/index/records.json
Fix: Run baton doctor --fix.
```

## Security and Privacy Considerations

- Baton is local-first and uses no telemetry by default.
- `.baton/` records stay on disk unless the user exports or syncs them manually.
- MCP tools are scoped to the configured store.
- MCP cannot execute shell commands.
- MCP cannot read arbitrary files by path; it reads Baton records and validates source references.
- Writes are auditable through `.baton/logs/audit.jsonl`.
- Secret scanning runs before writes using configured redaction patterns.
- Suspected secrets should block writes by default unless an explicit future override is designed.
- File references may point to sensitive files, so Baton stores references, not automatic file contents.
- Agent-written records default to unreviewed.
- Active decisions should be treated as constraints but not as unquestionable truth.

Path safety:

- All source file references in CLI flags, MCP inputs, `SourceLink.path`, and `scope.files` must be relative paths.
- After normalization, every referenced path must resolve under `config.project.root`.
- Absolute paths, home-directory paths, and traversal outside the project fail with `BATON_PATH_OUTSIDE_PROJECT`.
- Symlinks inside `.baton/` are rejected by `doctor` and must not be followed by read/write services.

Secret scanning:

- `redactPatterns` are JavaScript regular-expression source strings with optional flags.
- Default matching is case-insensitive.
- V1 also includes a high-entropy detector for likely API keys, JWTs, SSH private keys, and 32+ character token-like strings.
- On detection, write operations fail with `BATON_SECRET_DETECTED`; Baton should not store a redacted copy silently because the user may need to decide what context is safe to preserve.

Actor trust:

- CLI writes are human-authored by default; MCP writes are agent-authored by default.
- `--actor` and MCP `actorName` set only display names. `actorType` is derived from transport except for explicit CLI `--agent`.
- Agent-authored records default to `reviewStatus: "unreviewed"`.

## Error Handling

Error object shape:

```ts
interface BatonError {
  code: string;
  message: string;
  severity: "info" | "warn" | "error";
  path?: string;
  field?: string;
  details?: unknown;
  recovery?: string;
  exitCode?: number;
}
```

CLI display format:

```text
error BATON_STORE_NOT_FOUND
No .baton store was found for this project.

Fix:
  Run baton onboard.
```

MCP error response format:

```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "BATON_STORE_NOT_FOUND: No .baton store was found for this project."
    }
  ],
  "data": {
    "code": "BATON_STORE_NOT_FOUND",
    "severity": "error",
    "recovery": "Run baton onboard in the project root."
  }
}
```

Common error codes:

```text
BATON_STORE_NOT_FOUND
BATON_CONFIG_INVALID
BATON_RECORD_INVALID
BATON_RECORD_NOT_FOUND
BATON_RECORD_ID_AMBIGUOUS
BATON_SCHEMA_VERSION_UNSUPPORTED
BATON_INDEX_STALE
BATON_INDEX_CORRUPT
BATON_PATH_OUTSIDE_STORE
BATON_PATH_OUTSIDE_PROJECT
BATON_SECRET_DETECTED
BATON_MCP_READ_ONLY
BATON_PERMISSION_DENIED
BATON_WRITE_FAILED
BATON_AUDIT_WRITE_FAILED
BATON_SOURCE_LINK_INVALID
BATON_SYMLINK_REJECTED
BATON_CORRUPT_RECORD
```

## Testing Strategy

- Unit tests for ID generation, slugging, path canonicalization, schema validation, Markdown/YAML parsing.
- Schema tests for valid and invalid config/pass/brief/decision fixtures.
- CLI tests using temporary directories for every V1 command.
- MCP tests for every tool with read-only and write-enabled modes.
- MCP protocol-conformance tests for `initialize`, `tools/list`, and `tools/call` using SDK in-memory transport.
- One smoke test against a real local MCP client harness or `mcp-cli` equivalent.
- Fixture tests using a Claude-to-Codex demo `.baton/` store.
- Corrupt store tests for bad YAML, duplicate IDs, missing config, broken audit logs, invalid schema versions.
- Snapshot/golden tests for `status`, `doctor`, `brief list`, and error output.
- Cross-platform path tests for Windows-style paths, spaces, symlink rejection, and path traversal attempts.
- Source-link path tests proving absolute paths and sibling-directory traversal are rejected.
- Secret-scan tests for configured redaction patterns.
- Tests proving every successful write appends exactly one audit entry.
- Tests proving blocked secret writes append a `secret-blocked` audit entry without creating the source record.
- Schema-version mismatch tests for warnings vs failures.
- Derived index rebuild tests proving `index/` can be deleted and regenerated.

## Acceptance Criteria

- `npm install -g baton` or `npx baton onboard` works.
- `baton onboard` creates a valid `.baton/` store.
- Onboarding creates `.baton/.gitignore` that ignores `index/` and `logs/`.
- `baton doctor` reports healthy on a fresh store.
- `baton pass` creates a valid pass interactively and non-interactively.
- `get_latest_pass` returns the newest valid active pass.
- `get_recent_passes` returns the last 2-3 valid passes by default.
- MCP `get_brief` returns the default project brief from `.baton/brief.md`.
- `baton brief create`, `baton brief list`, and `baton brief show <id>` work.
- Targeted briefs can be filtered by title, tag, and target agent.
- MCP `create_brief`, `list_briefs`, and `get_targeted_brief` work.
- `baton decision add` and `baton decision list` create and list valid decision records.
- MCP `record_decision` and `get_decisions` work.
- `baton question add` and `baton question list` create and list unresolved open questions.
- `baton stale mark <id>` marks records stale without deleting them.
- `baton conflict add`, `baton conflict list`, and `baton conflict resolve` work for basic conflict records.
- Decision, question, stale, and conflict records are validated and included in status.
- `baton status` shows latest pass, open briefs, open questions, active conflicts, unresolved decisions, stale records, and validation issues.
- `baton doctor` catches invalid records and can rebuild derived index state.
- `baton mcp serve` exposes the expected V1 tools.
- MCP write tools record actor, timestamp, source tool, record type, and schema version.
- MCP tools cannot access files outside `.baton/`.
- CLI and MCP write tools reject source-link paths outside `config.project.root`.
- Every successful write produces exactly one entry in `.baton/logs/audit.jsonl`.
- Secret-blocked writes create no source record and append exactly one `secret-blocked` audit entry.
- README quickstart completes a Claude-to-Codex style pass loop from a fresh clone.
- README quickstart includes one targeted brief creation/retrieval step.
- Demo fixtures are included.
- The Claude-to-Codex demo fixture passes `baton doctor` and proves `get_brief`, `get_recent_passes`, `create_pass`, and `create_brief`.
- No cloud dependency exists.
- No telemetry exists.
- Tests pass.

## Future Considerations

- Hosted encrypted sync
- Team workspaces
- Managed MCP endpoint
- Browser UI
- Homebrew distribution
- SQLite FTS or another richer derived index after file-scan V1 proves insufficient
- Semantic/vector search
- LLM-assisted conflict detection
- Full `baton search <query>` command beyond V1 list/filter behavior
- Chat export importers
- Claude/Codex/Cursor-specific onboarding wizards
- Review/approval workflows
- Dedicated assumption record type
- Context health scoring
- Web landing page and demo video
- Enterprise audit, SSO, retention, and policy controls

## Open Questions

- None that block V1 implementation. Client-specific MCP config paths may change over time, so `baton onboard --mcp` must be implemented defensively: mutate only known config files after confirmation and otherwise print copy-pasteable instructions.
