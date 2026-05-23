# Technical Specification: 3Notch V1 MVP

## Recommended Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | Node.js 20+ LTS | Best fit for `npx @3notch/cli onboard`, broad developer availability, and MCP SDK support. |
| Language | TypeScript | Strong package ergonomics, typed schemas/interfaces, good CLI and MCP ecosystem fit. |
| CLI Framework | Commander | Small, stable, scriptable, and enough for 3Notch V1 without framework weight. |
| Bundler | tsup | Lightweight TypeScript bundling for a distributable npm CLI without adding framework complexity. |
| Local Storage | Human-readable Markdown files with YAML frontmatter, `config.json`, derived JSON manifest/index files | Records stay inspectable/editable. V1 uses file scans plus small derived JSON indexes to avoid native SQLite install friction. SQLite/FTS can be added later if scale requires it. |
| Schema Validation | JSON Schema + Ajv | Directly satisfies structured validation for files and MCP inputs; schemas are language-neutral. |
| MCP Server | `@modelcontextprotocol/sdk` over stdio | Aligns with Claude/Codex/Cursor-compatible local agent workflows; no hosted dependency. |
| Testing | Vitest, temp filesystem fixtures, execa-style CLI tests | Fast unit tests plus real command execution against isolated `.notch/` stores. |
| Packaging/Distribution | npm package `@3notch/cli` with `bin.notch`; `npx @3notch/cli onboard` first | Matches product positioning and keeps install/demo path short. Homebrew can follow later. |

## Overview

3Notch V1 is a local-first CLI and MCP server for passing project and private workflow context across repos and AI agents. It stores targeted briefs, session passes, decisions, packets, private seed packets, and status metadata in project-owned `.notch/` folders. The MVP focuses on one job: packaging the right source-linked context from prior work so the next repo, person, or agent can continue correctly without copy-paste, cloud sync, full chat-history ingestion, or broad agent orchestration.

## Product Principles

- Pass continuity, not generic memory.
- Local files are the source of truth.
- Cross-repo packets are first-class, not a later export feature.
- Private context seeding is first-class: user preferences and workflow conventions should move into a new repo without being committed by default.
- Agents write structured, auditable records.
- Humans can inspect and edit stored context.
- CLI first; MCP second; no web dashboard in V1.
- Store only targeted context, not whole private chats.
- Private seed context requires explicit user review/exposure before MCP tools can return it.
- Every write is attributable: actor, timestamp, source tool, record type, schema version.
- Validation should fail loudly with actionable fixes.
- Derived indexes must be rebuildable from source files.
- Features must answer: does this help the next agent continue correctly?

## Architecture Decision

Assumptions:

- 3Notch runs inside one project repository by default, but V1 must support moving scoped packets between two local repos/stores and importing private seed context from prior work into a new repo.
- The default store is `<project>/.notch/`; a destination can be another Git repo root, another `.notch/` path, or a packet file imported later.
- Source-of-truth records should be readable in a text editor.
- Agents may generate imperfect context, so validation, attribution, and review status matter.
- V1 should demo new-project seeding from prior work and Claude-to-Codex handoff across two repos quickly.

Recommended architecture: a TypeScript CLI package with a local file store, shared core services, a transfer service for packet create/import/send, a seed service for new-project bootstrap, and an MCP adapter exposing the same capabilities. The CLI owns onboarding, human workflows, private context seeding, packet transfer, status, and doctor checks. The MCP server exposes constrained tools for agents to read/write 3Notch records inside the current project store and to create/import packets when explicitly requested.

3Notch should not be a SaaS, dashboard, vector database, chat archive, or orchestration layer in V1. Those alternatives add trust, setup, and product complexity before the core workflow is proven. V1 should prove local packet transfer and private context seeding first: prior work creates a reviewed seed packet, a new repo imports it privately, source repo creates a project packet, and destination repo imports it. V1 should also avoid a native SQLite dependency: the expected store size is small enough for deterministic file scans, and `npx @3notch/cli onboard` should work without `node-gyp`, prebuilt binary, or platform-specific install failures.

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
- Background daemon beyond explicit `notch mcp serve`

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
        packet.ts
        send.ts
        seed.ts
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
      packet-service.ts
      transfer-service.ts
      seed-service.ts
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
        create-packet.ts
        import-packet.ts
        list-packets.ts
        get-packet.ts
        create-seed-packet.ts
        import-seed-packet.ts
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
      packet.schema.json
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
      packet.md
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

## Local 3Notch Store Layout

```text
.notch/
  .gitignore
  config.json
  brief.md
  passes/
  briefs/
  inbox/
  outbox/
  private/
    inbox/
    outbox/
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
private/
```

Records are intended to be project-owned and Git-friendly by default: `config.json`, `brief.md`, `passes/`, `briefs/`, `decisions/`, `questions/`, `conflicts/`, `inbox/`, and `outbox/` should not be ignored unless the user chooses a private workflow. Personal workflow context, user preferences, and seed packets belong under `private/`, which must be ignored by default.

### `config.json`

- Purpose: project-level 3Notch configuration.
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

### `inbox/`

- Purpose: imported packets from other repos, people, or agent sessions.
- Source of truth: yes.
- Manual edits: yes, but edits must keep packet schema valid.
- Validation: each `.md` file must satisfy `packet.schema.json`.
- V1 behavior: importing a packet copies it here and indexes it. Import does not silently merge decisions or overwrite local source records.

### `outbox/`

- Purpose: packets created from this repo for transfer elsewhere.
- Source of truth: yes.
- Manual edits: yes, but edits must keep packet schema valid.
- Validation: each `.md` file must satisfy `packet.schema.json`.
- V1 behavior: `notch packet create` writes a copy here and can also write/copy a packet file to a requested destination.

### `private/`

- Purpose: private seed packets and user/workflow context imported into this repo.
- Source of truth: yes, but local-private by default.
- Manual edits: yes, but edits must keep packet schema valid.
- Validation: packet files under `private/inbox/` and `private/outbox/` must satisfy `packet.schema.json`.
- Git behavior: ignored by `.notch/.gitignore` by default.
- MCP behavior: not exposed unless the MCP server is started with explicit private-context access.
- V1 behavior: `notch seed from <repo-or-store-path>` imports reviewed seed packets here. Normal project packet import does not write here unless `--private` or `sensitivity: private` is used.

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
- Validation: can be deleted and rebuilt with `notch doctor --fix` or a later `notch index rebuild`.
- Contents: `records.json` and `manifest.json`.
- V1 rule: do not use SQLite or native dependencies. Build status and list/filter behavior from file scans plus these derived JSON files.

### `logs/`

- Purpose: append-only audit log for 3Notch writes and maintenance operations.
- Source of truth: operational audit, not content source.
- Manual edits: no.
- Validation: JSONL parse validation; corrupted lines are reported by `doctor`.

## Audit Log Format

Every write operation must append exactly one JSON object to `.notch/logs/audit.jsonl`. V1 uses one append-only file with no rotation; rotation can be added later if large stores need it. `doctor` validates that every non-empty line parses and matches `audit.schema.json`.

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

Audit writes must be best-effort atomic: write the record first, append audit second, and surface `NOTCH_AUDIT_WRITE_FAILED` if the audit append fails. `doctor` reports records missing audit entries as warnings, not corruption, because local files remain the source of truth.

## Data Model

Common supporting types. `schemaVersion` is stored as a string and validated with `^\d+\.\d+\.\d+$`; examples must quote it in YAML frontmatter.

```ts
type RecordType =
  | "config"
  | "project_brief"
  | "pass"
  | "brief"
  | "packet"
  | "decision"
  | "question"
  | "conflict";
type ActorType = "human" | "agent" | "system";
type Confidence = "low" | "medium" | "high";
type ReviewStatus = "unreviewed" | "reviewed";
type RecordStatus = "draft" | "active" | "stale" | "superseded" | "archived";
type PacketPurpose = "handoff" | "seed" | "profile" | "archive";
type Sensitivity = "project" | "private";

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
    | "notch-cli"
    | "notch-mcp"
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
  kind: "file" | "url" | "commit" | "issue" | "record" | "command" | "repo";
  path?: string;
  url?: string;
  recordId?: string;
  commit?: string;
  repoRoot?: string;
  repoName?: string;
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

`updatedAt` is omitted on immutable create-only records until they are changed. Commands that rewrite a source record, such as `notch stale mark <id>` and `notch conflict resolve <id>`, must set `updatedAt` to the rewrite timestamp while preserving `createdAt`.

### 3Notch Config

```ts
interface RedactionRule {
  kind: "regex";
  value: string;
  flags?: string;
}

interface NotchConfig {
  schemaVersion: string;
  project: {
    name: string;
    root: string;
    defaultBranch?: string;
  };
  store: {
    path: ".notch";
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

### 3Notch Pass

```ts
interface NotchPass extends RecordMeta {
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

### 3Notch Brief

```ts
interface NotchBrief extends RecordMeta {
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

### Transfer Packet

```ts
interface PacketRecordRef {
  id: string;
  recordType: Exclude<RecordType, "config" | "packet">;
  title: string;
  path: string;
  summary?: string;
}

interface NotchPacket extends RecordMeta {
  recordType: "packet";
  title: string;
  purpose: PacketPurpose;
  sensitivity: Sensitivity;
  transferStatus: "draft" | "outbox" | "imported" | "archived";
  origin: {
    projectName: string;
    storePath: string;
    repoRoot?: string;
    repoRemote?: string;
    commit?: string;
    branch?: string;
  };
  recipient: {
    targetAgent?: string;
    targetPerson?: string;
    targetRepo?: string;
    targetStore?: string;
  };
  summary: string;
  privateContextSummary?: string;
  includedRecords: PacketRecordRef[];
  includedSourceLinks: SourceLink[];
  importNotes?: string;
  importedFrom?: string;
  importedAt?: string;
}
```

A packet is the V1 transfer unit. It is not a network message and does not imply secrecy. It is a portable, inspectable Markdown/YAML artifact that can be copied, attached, committed, or directly imported into another `.notch/` store.

A seed packet is a packet with `purpose: "seed"` and `sensitivity: "private"`. It carries reviewed user/workflow context into a new repo and imports to `.notch/private/inbox/` by default. Private seed packets are local files, not encrypted secrets in V1, so secret scanning still applies and users should review them before MCP exposure.

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
    inboxPackets: number;
    outboxPackets: number;
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
  warnings: NotchError[];
}
```

## File Formats

Persisted records use Markdown with YAML frontmatter. The frontmatter is schema-validated. The Markdown body is human-readable and must include required headings per record type.

### Default Project Brief

- File extension: `.md`
- Naming convention: `.notch/brief.md`
- Required frontmatter fields: `id`, `schemaVersion`, `recordType`, `status`, `projectName`, `createdAt`, `updatedAt`, `createdBy`, `sourceTool`, `tags`, `sourceLinks`, `reviewStatus`
- Required body headings: `## Current Focus`, `## Active Decisions`, `## Recent Passes`, `## Open Questions`, `## Warnings`
- Optional fields: none in V1 frontmatter; add content through the body sections.
- Example path: `.notch/brief.md`

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
  name: notch-cli
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

### 3Notch Config

- File extension: `.json`
- Naming convention: `.notch/config.json`
- Required fields: `schemaVersion`, `project`, `store`, `privacy`, `defaults`
- Optional fields: `project.defaultBranch`
- Example path: `.notch/config.json`
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
    "path": ".notch",
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

### A 3Notch Pass

- File extension: `.md`
- Naming convention: `.notch/passes/YYYYMMDDTHHMMSSZ-<slug>.md`
- Required fields: all `RecordMeta` fields, `title`, `currentTask`, `summary`, `nextActions`, `confidence`
- Optional fields: `previousPass`, `changedFiles`, `decisions`, `blockers`, `openQuestions`, `staleAssumptionsFound`
- Example path: `.notch/passes/20260523T183000Z-codex-route-guard.md`

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
  name: notch-mcp
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

### A Targeted 3Notch Brief

- File extension: `.md`
- Naming convention: `.notch/briefs/YYYYMMDDTHHMMSSZ-<slug>-for-<agent>.md`
- Required fields: `RecordMeta`, `title`, `targetAgent`, `goal`, `scope`, `exclusions`, `designBasis`, `priorReasoningSummary`
- Optional fields: `timeframe`, `openQuestions`, `recommendedNextSteps`
- Required body headings: `## Goal For <Target Agent>`, `## Relevant Background`, `## Prior Reasoning Summary`, `## Design Basis`, `## Important Decisions`, `## Relevant Files And Sources`, `## Known Pitfalls`, `## Open Questions`, `## Recommended Next Steps`
- Example path: `.notch/briefs/20260523T184000Z-march-training-feature-for-codex.md`

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
  name: notch-cli
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

### A Transfer Packet

- File extension: `.md`
- Naming convention, outbox: `.notch/outbox/YYYYMMDDTHHMMSSZ-<slug>-to-<recipient>.md`
- Naming convention, inbox: `.notch/inbox/YYYYMMDDTHHMMSSZ-<slug>-from-<project>.md`
- Naming convention, private seed inbox: `.notch/private/inbox/YYYYMMDDTHHMMSSZ-<slug>-seed-from-<project>.md`
- Portable filename convention: `YYYYMMDDTHHMMSSZ-<slug>.notch.md`
- Required fields: `RecordMeta`, `title`, `purpose`, `sensitivity`, `transferStatus`, `origin`, `recipient`, `summary`, `includedRecords`
- Optional fields: `includedSourceLinks`, `importNotes`, `importedFrom`, `importedAt`
- Required body headings: `## Summary`, `## Recipient`, `## Origin`, `## Included Context`, `## Source Links`, `## Import Notes`
- Additional seed packet headings: `## User Preferences`, `## Workflow Conventions`, `## Lessons From Prior Work`, `## What Not To Carry Forward`
- Example path: `.notch/outbox/20260523T192000Z-auth-refactor-to-codex.md`

```md
---
id: packet_20260523T192000Z_auth_refactor
schemaVersion: "1.0.0"
recordType: packet
status: active
title: Auth refactor handoff for implementation repo
purpose: handoff
sensitivity: project
transferStatus: outbox
createdAt: 2026-05-23T19:20:00Z
createdBy:
  actorType: human
  name: Alex
sourceTool:
  name: notch-cli
tags: [auth, cross-repo]
sourceLinks:
  - kind: repo
    repoName: planning-repo
    repoRoot: /Users/example/planning-repo
  - kind: file
    path: docs/auth-plan.md
reviewStatus: reviewed
origin:
  projectName: planning-repo
  storePath: /Users/example/planning-repo/.notch
  repoRoot: /Users/example/planning-repo
  branch: main
recipient:
  targetAgent: codex
  targetRepo: /Users/example/app-repo
summary: Carry the auth refactor plan from planning-repo into app-repo.
includedRecords:
  - id: brief_20260523T184000Z_auth_refactor
    recordType: brief
    title: Auth refactor implementation basis
    path: .notch/briefs/20260523T184000Z-auth-refactor-for-codex.md
includedSourceLinks:
  - kind: file
    path: docs/auth-plan.md
---

## Summary

Carry the auth refactor plan from planning-repo into app-repo.

## Recipient

Codex in `/Users/example/app-repo`.

## Origin

Created from planning-repo on `main`.

## Included Context

- `brief_20260523T184000Z_auth_refactor`

## Source Links

- `docs/auth-plan.md`

## Import Notes

Import into app-repo before implementation. Do not assume source paths exist in the destination repo.
```

### A Decision Record

- File extension: `.md`
- Naming convention: `.notch/decisions/YYYYMMDDTHHMMSSZ-<slug>.md`
- Required fields: `RecordMeta`, `title`, `decision`, `rationale`, `scope`, `confidence`
- Optional fields: `alternativesConsidered`, `supersedes`, `supersededBy`, `consequences`
- Example path: `.notch/decisions/20260523T185000Z-use-markdown-yaml-records.md`

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
  name: notch-cli
tags: [storage, architecture]
sourceLinks: []
reviewStatus: reviewed
confidence: high
scope: [local-store, v1]
supersedes: []
---

## Decision

3Notch V1 stores passes, briefs, and decisions as Markdown files with YAML frontmatter.

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
- Naming convention: `.notch/questions/YYYYMMDDTHHMMSSZ-<slug>.md`
- Required fields: `RecordMeta`, `title`, `question`, `status`, `relatedRecords`
- Optional fields: `context`, `targetAgent`
- Example path: `.notch/questions/20260523T190000Z-auth-redirect-target.md`

### A Conflict Record

- File extension: `.md`
- Naming convention: `.notch/conflicts/YYYYMMDDTHHMMSSZ-<slug>.md`
- Required fields: `RecordMeta`, `title`, `summary`, `conflictingRecords`, `status`
- Optional fields: `resolution`, `resolvedAt`, `resolvedBy`
- Example path: `.notch/conflicts/20260523T191000Z-local-store-format.md`

## Schema Validation

- Schema location: `src/schemas/*.schema.json`, packaged with the CLI.
- Validation library: Ajv in strict mode.
- Runtime validation behavior:
  - All writes validate before saving.
  - All reads validate before returning data to CLI or MCP.
  - `brief.md` validates against `project-brief.schema.json`.
  - `audit.jsonl` validates line-by-line against `audit.schema.json`.
  - `doctor` validates every file in `.notch/`.
  - Invalid records are excluded from normal status/search unless `--include-invalid` is added later.
- Path validation behavior: all file-reference inputs follow the Path Safety rules in Security and Privacy.
- Error format: structured `NotchError` objects with code, message, path, field, severity, and recovery guidance.
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
  - Future `notch migrate` may rewrite records after backup.
  - `doctor` may recommend migration but must not alter source records unless explicitly requested.

## CLI Specification

Global flags:

```text
--cwd <path>          Project root, default current working directory
--store <path>        3Notch store path, default .notch
--json                Machine-readable output
--quiet               Suppress non-error text
--no-color            Disable color
--actor <name>        Display name for the writer; does not set actor type
--agent <name>        Mark a CLI write as agent-authored and unreviewed
--source-tool <name>  Tool creating the record
```

Actor identity rules:

- `notch-cli` writes default to `actorType: "human"`.
- `notch-mcp` writes default to `actorType: "agent"`.
- `--actor` sets only the display name.
- `--agent` on CLI writes sets `actorType: "agent"` and `reviewStatus: "unreviewed"`.
- If `--actor` is omitted, resolve the display name from `git config user.name`, then `$USER` or `$USERNAME`, then `"unknown"`.
- Audit entries must record separate actor display-name and actor-type resolution sources.

Exit codes:

```text
0 success
1 validation or user input error
2 3Notch store not found
3 corrupted store or unparsable record
4 MCP startup/runtime error
5 security or permission error
6 store warning in strict mode
10 unexpected internal error
```

### `notch onboard`

- Purpose: initialize `.notch/`.
- Usage: `notch onboard [--name <project>] [--yes] [--mcp <client>] [--json]`
- Flags/options:
  - `--name <project>`
  - `--yes`
  - `--mcp claude-desktop|claude-code|codex|cursor|chatgpt-desktop|none`
  - `--force` only to repair missing starter files, never overwrite records silently
- Interactive behavior: detects Git root, asks whether to create `.notch/`, starter brief, `.notch/.gitignore`, and optional MCP config instructions.
- Non-interactive behavior: `--yes` creates default config and starter files.
- Output format: human summary or JSON object with created paths.
- MCP setup behavior:
  - For `claude-desktop` and `cursor`, 3Notch may update known local MCP config files only after explicit confirmation.
  - For `claude-code`, `codex`, and `chatgpt-desktop`, V1 may print copy-pasteable configuration instructions instead of mutating config files, because client config locations may vary.
  - All MCP setup output must include the equivalent `notch mcp serve --store <path>` command.
- Existing store behavior: a complete existing store is left unchanged; without `--force`, onboarding exits with an already-initialized message. With `--force`, onboarding may repair missing folders and starter files, but V1 must not migrate schemas or rewrite existing source records silently.
- Error cases: partial store without `--force`, root not writable, invalid project name, MCP config path unsupported.
- Exit codes: `0`, `1`, `5`, `10`.
- Example invocation: `npx @3notch/cli onboard --name my-app --yes`

### `notch brief`

- Purpose: show compact default project brief.
- Usage: `notch brief [--json]`
- Flags/options: `--json`
- Interactive behavior: none.
- Non-interactive behavior: prints brief and warnings.
- Output format: Markdown/text or JSON.
- Error cases: store missing, brief missing, `project-brief.schema.json` validation failed.
- Exit codes: `0`, `2`, `3`.
- Example invocation: `notch brief`

### `notch pass`

- Purpose: create an end-of-session handoff.
- Usage: `notch pass [options]`
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
- Example invocation: `notch pass --from codex --summary "Implemented route guard" --task "Auth middleware" --file src/middleware.ts --next "Review copy" --confidence medium`

### `notch brief create`

- Purpose: create a targeted brief.
- Usage: `notch brief create [options]`
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
- Example invocation: `notch brief create --title "March training feature" --to codex --goal "Implement March training updates" --file src/training --exclude "Billing"`

### `notch brief list`

- Purpose: list targeted briefs.
- Usage: `notch brief list [--tag <tag>] [--to <agent>] [--status <status>] [--since <date>] [--json]`
- Flags/options: `--tag`, `--to`, `--status`, `--since`, `--limit`, `--json`
- Interactive behavior: none.
- Non-interactive behavior: prints table/JSON.
- Output format: ID, title, target agent, tags, status, created date.
- Error cases: store missing, index corrupt with failed file-scan fallback.
- Exit codes: `0`, `2`, `3`.
- Example invocation: `notch brief list --to codex --tag training`

### `notch brief show <id>`

- Purpose: show a targeted brief by ID or slug.
- Usage: `notch brief show <id> [--json] [--metadata]`
- Flags/options: `--json`, `--metadata`
- Interactive behavior: none.
- Non-interactive behavior: exact deterministic lookup.
- Output format: Markdown by default; JSON if requested. `--metadata` includes validated frontmatter before the Markdown body.
- Error cases: not found, invalid record.
- Exit codes: `0`, `1`, `2`, `3`.
- Example invocation: `notch brief show march-training-feature`

### `notch packet create`

- Purpose: package selected source-linked context from the current repo into a portable transfer packet.
- Usage: `notch packet create [options]`
- Flags/options:
  - `--title <title>`
  - `--to-agent <agent>`
  - `--to-person <name>`
  - `--to-repo <path-or-name>`
  - `--task <text>`
  - `--summary <text>`
  - `--purpose handoff|seed|profile|archive`
  - `--private` shorthand for `--purpose seed --sensitivity private`
  - `--sensitivity project|private`
  - `--include <record-ref>` repeatable, such as `brief:<id>`, `pass:latest`, `decision:<id>`, `question:<id>`, or `file:<relative-path>`
  - `--file <path>` repeatable, shorthand for `--include file:<path>`
  - `--out <path>` write an additional portable packet file outside `.notch/outbox/`
  - `--stdin` read structured packet input
  - `--editor` edit the packet body before validation
  - `--json`
- Interactive behavior: prompts for recipient, destination repo if known, task, summary, included records, included files, warnings, and next steps.
- Non-interactive behavior: required title/recipient/summary can be supplied by flags or stdin. At least one included record, file, or body section is required.
- Output format: created packet ID, outbox path, optional external output path, sensitivity, and warnings; JSON if requested.
- Store behavior: project packets write a validated copy to `.notch/outbox/`. Private packets write to `.notch/private/outbox/`. If `--out` is supplied, writes a second portable copy to that exact path after validation.
- Error cases: missing recipient, missing summary/content, invalid include reference, file path outside origin project root, destination path unsafe, secret detected, schema invalid, write denied.
- Exit codes: `0`, `1`, `2`, `3`, `5`.
- Example invocation: `notch packet create --title "Auth handoff" --to-agent codex --to-repo ../api --include pass:latest --file src/auth.ts --summary "Carry auth context into the API repo"`

### `notch packet import <file>`

- Purpose: validate a portable packet and copy it into a destination inbox.
- Usage: `notch packet import <file> [--into <repo-or-store-path>] [--as-reviewed] [--private] [--json]`
- Flags/options:
  - `--into <repo-or-store-path>` imports into another local repo/store path instead of the current repo
  - `--as-reviewed` marks import review status as reviewed by the importing actor
  - `--private` imports into `.notch/private/inbox/` regardless of packet sensitivity
  - `--json`
- Interactive behavior: confirms destination store if importing outside the current repo and warns before importing a packet with schema warnings.
- Non-interactive behavior: validates input file, resolves destination store, copies the packet to `inbox/` or `private/inbox/`, writes audit entry, and rebuilds derived index.
- Output format: imported packet ID/path, origin project metadata, destination store, and warnings; JSON if requested.
- Store behavior: import does not merge decisions, overwrite existing records, or rewrite origin source links. If a packet ID or filename collides, create a suffixed inbox filename and preserve the original packet ID plus import metadata. Packets with `sensitivity: private` import to `.notch/private/inbox/` by default.
- Error cases: file missing, packet schema invalid, destination store missing, destination not writable, duplicate explicit import with `--strict` in future, secret detected, symlink/traversal issue.
- Exit codes: `0`, `1`, `2`, `3`, `5`.
- Example invocation: `notch packet import ../source/.notch/outbox/20260523T192000Z-auth-handoff-to-codex.md`

### `notch packet list`

- Purpose: list inbox and outbox packets.
- Usage: `notch packet list [--inbox] [--outbox] [--private] [--to <recipient>] [--from <project>] [--since <date>] [--json]`
- Flags/options: `--inbox`, `--outbox`, `--private`, `--to`, `--from`, `--purpose`, `--since`, `--limit`, `--json`
- Interactive behavior: none.
- Non-interactive behavior: scans valid packet records in `.notch/inbox/` and `.notch/outbox/`. Includes `.notch/private/` only when `--private` is supplied. Defaults to both directions unless one direction flag is supplied.
- Output format: ID, title, direction, origin project, recipient, created/imported date, and summary.
- Error cases: store missing, corrupted packet skipped with warning unless strict mode is added later.
- Exit codes: `0`, `2`, `3`.
- Example invocation: `notch packet list --inbox --from web-app`

### `notch packet show <id>`

- Purpose: show an imported or outbox packet by ID, slug, or filename stem.
- Usage: `notch packet show <id> [--inbox] [--outbox] [--json] [--metadata]`
- Flags/options: `--inbox`, `--outbox`, `--json`, `--metadata`
- Interactive behavior: none.
- Non-interactive behavior: deterministic lookup across packet directories; direction flags narrow the search.
- Output format: Markdown by default; JSON if requested. `--metadata` includes packet frontmatter and import metadata before the body.
- Error cases: not found, ambiguous ID across inbox/outbox, invalid packet.
- Exit codes: `0`, `1`, `2`, `3`.
- Example invocation: `notch packet show packet_20260523T192000Z_auth_handoff`

### `notch send`

- Purpose: shortcut for creating a packet from the current repo and importing or copying it into another local repo/store.
- Usage: `notch send --to <repo-or-store-path> [packet-create-options]`
- Flags/options:
  - `--to <repo-or-store-path>` destination Git repo root, `.notch/` path, or packet file path
  - accepts packet creation flags such as `--title`, `--to-agent`, `--to-person`, `--task`, `--summary`, `--purpose`, `--private`, `--include`, `--file`, `--stdin`, `--editor`, and `--json`
- Interactive behavior: prompts for packet fields and confirms destination.
- Non-interactive behavior: creates a packet in the current repo's `.notch/outbox/`. If `--to` resolves to a repo/store, imports a copy into destination `.notch/inbox/`. If `--to` resolves to a file path or ends in `.md`, writes the portable file there.
- Output format: outbox packet path, destination inbox/file path, and warnings; JSON if requested.
- V1 boundary: local filesystem only. No hosted delivery, accounts, hosted inbox service, remote push, or encryption.
- Error cases: missing destination, destination store missing, destination not writable, destination outside allowed path policy, source schema invalid, secret detected, import failed after outbox write.
- Exit codes: `0`, `1`, `2`, `3`, `5`.
- Example invocation: `notch send --to ../api --to-agent codex --include pass:latest --summary "Continue API work with the frontend auth context"`

### `notch seed from <repo-or-store-path>`

- Purpose: bootstrap a new repo with reviewed private context from prior work.
- Usage: `notch seed from <repo-or-store-path> [--include <category>] [--file <path>] [--review] [--json]`
- Flags/options:
  - `--include profile|preferences|workflow|conventions|decisions|lessons|prompts` repeatable
  - `--file <path>` repeatable, explicit source files to reference or summarize
  - `--review` open the generated seed packet for review before import
  - `--out <path>` write a portable private seed packet without importing
  - `--json`
- Interactive behavior: asks what prior context should carry forward, generates a seed packet draft, and requires review unless `--yes` is added in a future version.
- Non-interactive behavior: reads a prior `.notch/` store or explicitly provided files, creates a packet with `purpose: "seed"` and `sensitivity: "private"`, and imports it into the current repo's `.notch/private/inbox/`.
- Output format: private seed packet ID/path, source store path, imported private inbox path, and warnings; JSON if requested.
- Store behavior: never writes seed packets to normal `.notch/inbox/` unless explicitly forced by a future flag. Does not merge user preferences into public project records.
- MCP behavior: imported seed packets remain hidden from MCP unless the server is started with private context enabled.
- V1 boundary: no automatic scraping of private chats. V1 should use prior `.notch/` stores and explicit user-selected files.
- Error cases: source store missing, no includable context, review not completed, secret detected, destination private inbox not writable, source path unsafe.
- Exit codes: `0`, `1`, `2`, `3`, `5`.
- Example invocation: `notch seed from ../iPSM --include preferences --include workflow --include lessons --review`

### `notch decision add`

- Purpose: create a decision record that future agents should treat as project context.
- Usage: `notch decision add [--title <title>] [--decision <text>] [--rationale <text>] [--scope <scope>] [--confidence low|medium|high] [--tag <tag>] [--editor] [--json]`
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
- Example invocation: `notch decision add --title "Use file-scan index for V1" --decision "Avoid SQLite in V1" --rationale "Keep npx install reliable" --scope storage --confidence high`

### `notch decision list`

- Purpose: list active, stale, superseded, or archived decisions.
- Usage: `notch decision list [--status active|stale|superseded|archived] [--tag <tag>] [--since <date>] [--json]`
- Flags/options: `--status`, `--tag`, `--since`, `--limit`, `--json`
- Interactive behavior: none.
- Non-interactive behavior: prints table/JSON.
- Output format: ID, title, status, confidence, tags, created date.
- Error cases: store missing, invalid decision record.
- Exit codes: `0`, `2`, `3`.
- Example invocation: `notch decision list --status active`

### `notch question add`

- Purpose: record an unresolved open question.
- Usage: `notch question add [--title <title>] [--question <text>] [--to <agent>] [--tag <tag>] [--json]`
- Flags/options: `--title`, `--question`, `--to`, `--tag`, `--file`, `--record`, `--stdin`, `--editor`, `--json`
- Interactive behavior: prompts for the question, context, target agent if any, related files, and related records.
- Non-interactive behavior: required fields supplied through flags/stdin.
- Output format: question ID/path; JSON if requested.
- Error cases: missing question, invalid related record, path outside project root, secret detected, schema invalid.
- Exit codes: `0`, `1`, `2`, `5`.
- Example invocation: `notch question add --title "Auth redirect target" --question "Should unauthenticated users land on /login or /welcome?" --to claude --tag auth`

### `notch question list`

- Purpose: list unresolved open questions.
- Usage: `notch question list [--to <agent>] [--tag <tag>] [--since <date>] [--json]`
- Flags/options: `--to`, `--tag`, `--since`, `--limit`, `--json`
- Interactive behavior: none.
- Non-interactive behavior: prints table/JSON.
- Output format: ID, title, target agent, tags, created date.
- Error cases: store missing, invalid question record.
- Exit codes: `0`, `2`, `3`.
- Example invocation: `notch question list --to claude`

### `notch stale mark <id>`

- Purpose: mark an existing record stale so future agents do not treat it as active context.
- Usage: `notch stale mark <id> [--reason <text>] [--json]`
- Flags/options: `--reason`, `--json`
- Interactive behavior: prompts for reason if omitted.
- Non-interactive behavior: requires `--reason` unless `--json` stdin supplies it.
- Output format: updated record ID/path and audit event ID; JSON if requested.
- Error cases: record not found, default project brief, record already archived, schema rewrite failed, audit append failed.
- No-op behavior: records already marked `stale` or `superseded` remain unchanged and return a warning instead of rewriting the record.
- Exit codes: `0`, `1`, `2`, `3`, `5`.
- Example invocation: `notch stale mark decision_20260523T185000Z_markdown_yaml_records --reason "Superseded by file-scan V1 decision"`

### `notch conflict add`

- Purpose: create a basic conflict record when two or more active records contradict each other.
- Usage: `notch conflict add [--title <title>] [--summary <text>] [--record <id>]... [--json]`
- Flags/options: `--title`, `--summary`, `--record` repeatable, `--tag`, `--stdin`, `--editor`, `--json`
- Interactive behavior: prompts for title, summary, and conflicting record IDs.
- Non-interactive behavior: requires summary and at least two distinct `--record` values.
- Output format: conflict ID/path; JSON if requested.
- Error cases: missing records, fewer than two distinct records, duplicate record references, schema invalid, write denied.
- Exit codes: `0`, `1`, `2`, `5`.
- Example invocation: `notch conflict add --title "Storage source of truth" --summary "One note says SQLite source of truth; another says Markdown source of truth." --record decision_a --record pass_b`

### `notch conflict list`

- Purpose: list active or resolved conflict records.
- Usage: `notch conflict list [--status active|archived] [--tag <tag>] [--json]`
- Flags/options: `--status`, `--tag`, `--limit`, `--json`
- Interactive behavior: none.
- Non-interactive behavior: prints table/JSON.
- Output format: ID, title, status, conflicting records, created date.
- Error cases: store missing, invalid conflict record.
- Exit codes: `0`, `2`, `3`.
- Example invocation: `notch conflict list --status active`

### `notch conflict resolve <id>`

- Purpose: resolve a conflict record without deleting its history.
- Usage: `notch conflict resolve <id> [--resolution <text>] [--json]`
- Flags/options: `--resolution`, `--json`
- Interactive behavior: prompts for resolution if omitted.
- Non-interactive behavior: requires `--resolution`.
- Output format: updated conflict ID/path and audit event ID; JSON if requested.
- Error cases: conflict not found, already archived, schema rewrite failed, audit append failed.
- Exit codes: `0`, `1`, `2`, `3`, `5`.
- Example invocation: `notch conflict resolve conflict_20260523T191000Z_local_store_format --resolution "Markdown/YAML source files are authoritative; index is derived."`

### `notch status`

- Purpose: summarize current 3Notch project state.
- Usage: `notch status [--json] [--stale-after-days <n>]`
- Flags/options: `--json`, `--stale-after-days`
- Interactive behavior: none.
- Non-interactive behavior: CI-safe summary.
- Output format: human summary or `ProjectStatusSummary`, including inbox/outbox packet counts, private seed packet count, and most recent imported packet.
- Error cases: store missing, config invalid, validation issues.
- Exit codes: `0` if usable, `6` if validation warnings in strict CI mode, `2`, `3`.
- Example invocation: `notch status --json`

### `notch doctor`

- Purpose: validate and repair safe derived store state.
- Usage: `notch doctor [--json] [--fix] [--yes] [--strict]`
- Flags/options:
  - `--fix` rebuilds index and creates missing derived folders only
  - `--yes` applies safe fixes without prompting when used with `--fix`
  - `--strict` treats warnings as failures
  - `--json`
- Interactive behavior: asks before safe fixes unless `--fix --yes`.
- Non-interactive behavior: returns structured diagnostics.
- Output format: checks, severity, affected path, suggested fix.
- Validation scope: validates `.notch/inbox/`, `.notch/outbox/`, and `.notch/private/` packet schemas, packet ID collisions, import metadata, destination store layout, private ignore rules, and derived packet index state.
- Path-link distinction: origin source links inside imported packets may reference files outside the destination repo. Doctor should warn on missing origin references when useful, but must not treat origin references as destination path traversal. Local write paths and destination import paths still use strict traversal and symlink checks.
- Error cases: config invalid, corrupted records, corrupted packets, index rebuild failed, permission denied.
- Exit codes: `0` healthy, `6` warnings in strict mode, `1` unhealthy, `2` missing store, `3` corrupted store, `5` permission.
- Example invocation: `notch doctor --fix`

### `notch mcp serve`

- Purpose: start the local MCP server.
- Usage: `notch mcp serve [--store <path>] [--read-only] [--include-private] [--default-actor <name>]`
- Flags/options:
  - `--read-only`
  - `--include-private` exposes `.notch/private/` seed packets to packet read tools for this MCP server process
  - `--default-actor <name>`
  - `--log-file <path>`
- Interactive behavior: none; MCP runs over stdio.
- Non-interactive behavior: required for agent clients.
- Output format: MCP protocol messages only on stdio; logs go to stderr/file.
- Error cases: store missing, config invalid, MCP initialization failed, write tool disabled.
- Exit codes: `0`, `2`, `3`, `4`, `5`.
- Example invocation: `notch mcp serve --read-only`

## MCP Tool Specification

All MCP tools are scoped to the resolved `.notch/` store. They must reject path traversal, arbitrary filesystem access, broad project file reads, and shell execution. The only V1 exception is `import_packet`, which may read exactly the user-supplied packet file path after path-safety validation so it can copy the packet into the current store's inbox. Private seed packets under `.notch/private/` are hidden unless `notch mcp serve --include-private` is used. Tool `inputSchema` values must be real JSON Schemas, not free-text descriptions. MCP writes follow the actor trust rules in Security and Privacy, and write tools are disabled when `notch mcp serve --read-only` is active. If `config.defaults.allowedMcpWriteTools` is empty, the MCP server still starts and read tools work, but all write tools behave as disabled and return `NOTCH_MCP_READ_ONLY`.

### `get_brief`

- Purpose: return the default project brief from `.notch/brief.md`; this is the cold-start tool agents should call before work.
- Input schema: `{ includeMarkdown?: boolean }`
- Output schema: `{ brief: ProjectBrief, markdown?: string, statusCounts: ProjectStatusSummary["counts"], warnings: NotchError[] }`
- Read/write behavior: read.
- Security boundaries: reads only `.notch/brief.md` and derived status counts.
- Failure modes: store missing, project brief missing, `project-brief.schema.json` validation failed.

### `create_pass`

- Purpose: write a 3Notch Pass.
- Input schema: `{ actorName?: string, title: string, fromAgent?: string, toAgent?: string, previousPass?: string, currentTask: string, summary: string, changedFiles?: SourceLink[], decisions?: string[], blockers?: string[], openQuestions?: string[], staleAssumptionsFound?: string[], nextActions: string[], confidence?: Confidence, tags?: string[] }`
- Output schema: `{ id: string, path: string, createdAt: string, warnings: NotchError[] }`
- Read/write behavior: write.
- Security boundaries: can only create files under `.notch/passes/`; all file paths must be relative and resolve under `config.project.root`.
- Failure modes: store missing, schema invalid, read-only mode, source path outside project, secret detected, audit write failed, write failed.

### `get_latest_pass`

- Purpose: retrieve most recent valid active pass.
- Input schema: `{ targetAgent?: string, maxAgeDays?: number, includeMarkdown?: boolean }`
- Output schema: `{ pass: NotchPass | null, markdown?: string, stale: boolean, warnings: NotchError[] }`
- Read/write behavior: read.
- Security boundaries: reads only `.notch/passes/`.
- Failure modes: no passes, invalid latest pass, store missing.

### `get_recent_passes`

- Purpose: retrieve recent valid active passes for cold-start continuation.
- Input schema: `{ limit?: number, sinceDays?: number, fromAgent?: string, targetAgent?: string, includeMarkdown?: boolean }`
- Output schema: `{ passes: Array<{ pass: NotchPass, markdown?: string, stale: boolean }>, warnings: NotchError[] }`
- Read/write behavior: read.
- Security boundaries: reads only `.notch/passes/`.
- Failure modes: store missing, invalid records skipped with warnings.
- Defaults: `limit` defaults to `3` and must be between `1` and `10`.

### `create_brief`

- Purpose: write a targeted brief.
- Input schema: `{ actorName?: string, title: string, targetAgent: string, goal: string, scope: { topics: string[], files: string[], timeframe?: string }, exclusions: string[], relevantFiles?: SourceLink[], designBasis: string, priorReasoningSummary: string, constraints?: string[], openQuestions?: string[], recommendedNextSteps?: string[], tags?: string[] }`
- Output schema: `{ id: string, path: string, createdAt: string, warnings: NotchError[] }`
- Read/write behavior: write.
- Security boundaries: can only create files under `.notch/briefs/`; all file paths must be relative and resolve under `config.project.root`.
- Failure modes: schema invalid, missing target agent, duplicate explicit slug, source path outside project, read-only mode, secret detected, audit write failed.

### `list_briefs`

- Purpose: list targeted briefs by filters.
- Input schema: `{ targetAgent?: string, tags?: string[], status?: RecordStatus, since?: string, limit?: number }`
- Output schema: `{ briefs: Array<{ id: string, title: string, goal: string, targetAgent: string, tags: string[], status: RecordStatus, createdAt: string }> }`
- Read/write behavior: read.
- Security boundaries: reads only `.notch/briefs/` and derived index files.
- Failure modes: invalid record skipped with warning.

### `get_targeted_brief`

- Purpose: read a targeted brief by ID or slug.
- Input schema: `{ id: string, includeMarkdown?: boolean }`
- Output schema: `{ brief: NotchBrief, markdown?: string, warnings: NotchError[] }`
- Read/write behavior: read.
- Security boundaries: no arbitrary path input; ID/slug lookup only.
- Failure modes: not found, invalid record.

### `create_packet`

- Purpose: package scoped context from the current store into a portable packet.
- Input schema: `{ actorName?: string, title: string, purpose?: PacketPurpose, sensitivity?: Sensitivity, toAgent?: string, toPerson?: string, toRepo?: string, task?: string, summary: string, include?: PacketRecordRef[], sourceLinks?: SourceLink[], warnings?: string[], nextActions?: string[], outputPath?: string }`
- Output schema: `{ id: string, outboxPath: string, outputPath?: string, createdAt: string, warnings: NotchError[] }`
- Read/write behavior: write.
- Security boundaries: writes project packets to `.notch/outbox/` and private packets to `.notch/private/outbox/`, plus an explicit `outputPath` when supplied. Included local file links must resolve under the origin project root. `outputPath` must pass safe destination path checks and cannot be a symlink target inside `.notch/`.
- Failure modes: schema invalid, missing recipient, missing summary, include reference not found, path outside project, read-only mode, secret detected, audit write failed.

### `import_packet`

- Purpose: validate a portable packet and copy it into the current store's inbox.
- Input schema: `{ actorName?: string, packetPath: string, asReviewed?: boolean }`
- Output schema: `{ id: string, inboxPath: string, importedAt: string, originProject?: string, warnings: NotchError[] }`
- Read/write behavior: write.
- Security boundaries: reads exactly the supplied packet file and writes only `.notch/inbox/` or `.notch/private/inbox/`, audit log, and derived index files. V1 MCP import does not accept arbitrary destination repo paths; cross-store sends should be performed by the CLI.
- Failure modes: file missing, path traversal, schema invalid, read-only mode, secret detected, write failed, audit write failed.

### `list_packets`

- Purpose: list imported and outbox packets visible to the current store.
- Input schema: `{ direction?: "inbox" | "outbox" | "both", includePrivate?: boolean, purpose?: PacketPurpose, to?: string, fromProject?: string, since?: string, limit?: number }`
- Output schema: `{ packets: Array<{ id: string, title: string, direction: "inbox" | "outbox", originProject?: string, recipient?: string, createdAt: string, importedAt?: string, summary: string }>, warnings: NotchError[] }`
- Read/write behavior: read.
- Security boundaries: reads only `.notch/inbox/`, `.notch/outbox/`, and derived indexes. Reads `.notch/private/` only when both `includePrivate` is true and the MCP server was started with `--include-private`.
- Failure modes: store missing, invalid packet skipped with warning.
- Defaults: `direction` defaults to `"both"` and `limit` defaults to `10` with max `50`.

### `get_packet`

- Purpose: read an imported or outbox packet by ID or slug.
- Input schema: `{ id: string, direction?: "inbox" | "outbox" | "both", includePrivate?: boolean, includeMarkdown?: boolean }`
- Output schema: `{ packet: NotchPacket, markdown?: string, warnings: NotchError[] }`
- Read/write behavior: read.
- Security boundaries: no arbitrary path input; ID/slug lookup only across packet directories.
- Failure modes: not found, ambiguous ID, invalid packet.

### `create_seed_packet`

- Purpose: create a private seed packet from reviewed user/workflow context.
- Input schema: `{ actorName?: string, title: string, sourceStorePath?: string, summary: string, userPreferences?: string[], workflowConventions?: string[], lessons?: string[], prompts?: string[], sourceLinks?: SourceLink[], outputPath?: string }`
- Output schema: `{ id: string, privateOutboxPath: string, outputPath?: string, createdAt: string, warnings: NotchError[] }`
- Read/write behavior: write.
- Security boundaries: writes only `.notch/private/outbox/` plus explicit `outputPath`. The tool cannot scan arbitrary source repos; callers must provide selected context or use CLI `notch seed from`.
- Failure modes: private context disabled by config, read-only mode, secret detected, schema invalid, write failed.

### `import_seed_packet`

- Purpose: import a private seed packet into the current store's private inbox.
- Input schema: `{ actorName?: string, packetPath: string, asReviewed?: boolean }`
- Output schema: `{ id: string, privateInboxPath: string, importedAt: string, originProject?: string, warnings: NotchError[] }`
- Read/write behavior: write.
- Security boundaries: reads exactly the supplied packet file and writes only `.notch/private/inbox/`, audit log, and derived index files. It does not merge preferences into public project records.
- Failure modes: file missing, packet is not `purpose: "seed"` or `sensitivity: "private"`, path traversal, read-only mode, secret detected, write failed.

### `record_decision`

- Purpose: create a decision record.
- Input schema: `{ actorName?: string, title: string, decision: string, rationale: string, scope: string[], confidence?: Confidence, tags?: string[], sourceLinks?: SourceLink[] }`
- Output schema: `{ id: string, path: string, createdAt: string, warnings: NotchError[] }`
- Read/write behavior: write.
- Security boundaries: writes only `.notch/decisions/`; file source links must stay under project root.
- Failure modes: schema invalid, read-only mode, source path outside project, secret detected, audit write failed.

### `get_decisions`

- Purpose: list decision records for current project context.
- Input schema: `{ status?: RecordStatus, tags?: string[], since?: string, limit?: number }`
- Output schema: `{ decisions: Array<{ id: string, title: string, decision: string, status: RecordStatus, confidence: Confidence, tags: string[], createdAt: string }> }`
- Read/write behavior: read.
- Security boundaries: reads only `.notch/decisions/`.
- Failure modes: store missing, invalid record skipped with warning.

### `add_open_question`

- Purpose: create an open question record.
- Input schema: `{ actorName?: string, title: string, question: string, context?: string, targetAgent?: string, relatedRecords?: string[], tags?: string[], sourceLinks?: SourceLink[] }`
- Output schema: `{ id: string, path: string, createdAt: string, warnings: NotchError[] }`
- Read/write behavior: write.
- Security boundaries: writes only `.notch/questions/`; source links must stay under project root.
- Failure modes: schema invalid, related record not found, read-only mode, source path outside project, secret detected.

### `get_open_questions`

- Purpose: list unresolved open questions.
- Input schema: `{ targetAgent?: string, tags?: string[], since?: string, limit?: number }`
- Output schema: `{ questions: Array<{ id: string, title: string, question: string, targetAgent?: string, tags: string[], createdAt: string }> }`
- Read/write behavior: read.
- Security boundaries: reads only `.notch/questions/`.
- Failure modes: store missing, invalid record skipped with warning.

### `mark_context_stale`

- Purpose: mark an existing record stale.
- Input schema: `{ actorName?: string, id: string, reason: string }`
- Output schema: `{ id: string, path: string, status: "stale", auditWritten: boolean, warnings: NotchError[] }`
- Read/write behavior: write.
- Security boundaries: may update only 3Notch source records inside `.notch/`; cannot modify config, logs, or derived index files.
- Failure modes: record not found, default project brief, record archived, read-only mode, schema rewrite failed, audit write failed.

### `create_conflict`

- Purpose: create a basic conflict record.
- Input schema: `{ actorName?: string, title: string, summary: string, conflictingRecords: string[], tags?: string[], sourceLinks?: SourceLink[] }`
- Output schema: `{ id: string, path: string, createdAt: string, warnings: NotchError[] }`
- Read/write behavior: write.
- Input validation: `conflictingRecords` must contain at least two distinct record IDs.
- Security boundaries: writes only `.notch/conflicts/`.
- Failure modes: fewer than two distinct records, duplicate record references, referenced record not found, read-only mode, schema invalid, secret detected.

### `list_conflicts`

- Purpose: list active or archived conflict records.
- Input schema: `{ status?: "active" | "archived", tags?: string[], limit?: number }`
- Output schema: `{ conflicts: Array<{ id: string, title: string, summary: string, status: string, conflictingRecords: string[], createdAt: string }> }`
- Read/write behavior: read.
- Security boundaries: reads only `.notch/conflicts/`.
- Failure modes: invalid record skipped with warning.

### `resolve_conflict`

- Purpose: archive a conflict record with a resolution.
- Input schema: `{ actorName?: string, id: string, resolution: string }`
- Output schema: `{ id: string, path: string, status: "archived", resolvedAt: string, warnings: NotchError[] }`
- Read/write behavior: write.
- Security boundaries: may update only `.notch/conflicts/` records.
- Failure modes: conflict not found, read-only mode, schema rewrite failed, audit write failed.

### `get_status`

- Purpose: return current 3Notch status summary.
- Input schema: `{ includeWarnings?: boolean }`
- Output schema: `ProjectStatusSummary`
- Read/write behavior: read.
- Security boundaries: reads only store files, including packet counts from `.notch/inbox/`, `.notch/outbox/`, and private counts from `.notch/private/`.
- Failure modes: store missing, config invalid, corrupted records.

### `run_doctor`

- Purpose: validate 3Notch store.
- Input schema: `{ strict?: boolean, fixDerivedState?: boolean }`
- Output schema: `{ healthy: boolean, checks: DoctorCheck[], errors: NotchError[] }`
- Read/write behavior: read by default; may rebuild `index/` only when `fixDerivedState` is true and the server is not in read-only mode.
- Security boundaries: cannot modify source records. Imported packet origin links are validated as metadata, not as local destination paths.
- Failure modes: permission denied, corrupted files, schema mismatch, read-only mode with `fixDerivedState: true`.

## Core Services

| Service | File path | Inputs | Outputs | Key functions | Error handling |
|---------|-----------|--------|---------|---------------|----------------|
| Config service | `src/core/config-service.ts` | cwd/store path | `NotchConfig` | resolve store, read config, write initial config | `STORE_NOT_FOUND`, `CONFIG_INVALID` |
| Store service | `src/core/store-service.ts` | record type, paths | parsed records/files | canonicalize paths, atomic write, file scan | `PATH_OUTSIDE_STORE`, `WRITE_FAILED` |
| Schema validation service | `src/core/schema-service.ts` | object/schema ID | validated data | load schemas, validate records, format errors | `SCHEMA_INVALID`, `UNSUPPORTED_SCHEMA_VERSION` |
| Pass service | `src/core/pass-service.ts` | pass input | `NotchPass` | create pass, list passes, get latest pass | validation/security errors |
| Brief service | `src/core/brief-service.ts` | brief input/filter | `NotchBrief` records | create/list/get targeted briefs | not found, ambiguous ID |
| Packet service | `src/core/packet-service.ts` | packet input/filter | `NotchPacket` records | create packet, list inbox/outbox packets, get packet, validate packet body | invalid includes, ambiguous ID |
| Transfer service | `src/core/transfer-service.ts` | packet files, destination paths | imported/copied packets | import packet, send packet to local repo/store/file path, preserve origin metadata | destination missing, unsafe path, partial transfer warning |
| Seed service | `src/core/seed-service.ts` | prior store path, include categories | private seed packets | create/import seed packets, write private inbox/outbox, enforce review/exposure rules | missing prior store, secret detected, private disabled |
| Decision service | `src/core/decision-service.ts` | decision input/filter | decisions/status refs | create decisions, parse decisions, list active decisions, detect supersession | invalid records |
| Question service | `src/core/question-service.ts` | question input/filter | open question records | create/list open questions | invalid records |
| Conflict service | `src/core/conflict-service.ts` | conflict input/filter | conflict records | create/list/resolve conflicts | invalid records, missing related records |
| Stale service | `src/core/stale-service.ts` | record ID/reason | updated source record | mark records stale, preserve audit trail | missing records, invalid rewrites |
| Status service | `src/core/status-service.ts` | store records | `ProjectStatusSummary` | compute counts, stale records, latest pass, questions, conflicts | degraded output with warnings |
| Doctor service | `src/core/doctor-service.ts` | store path/config | diagnostics | validate structure, schemas, derived indexes, links, secrets, symlinks | severity-coded diagnostics |
| MCP adapter | `src/mcp/server.ts` | MCP requests | MCP responses | register tools, enforce read-only/write policy | MCP errors wrapping `NotchError` |
| CLI adapter | `src/cli/index.ts` | argv/stdin | stdout/stderr/exit code | parse commands, call services, format output | maps `NotchError` to CLI output |

## 3Notch Pass Behavior

A pass is created when a human or agent ends a work session.

Creation flow:

1. Resolve project root and `.notch/`.
2. Collect required fields from flags, stdin, MCP input, or prompts.
3. Generate ID and filename from timestamp and title.
4. Attach metadata: actor, timestamp, source tool, schema version, record type.
5. Validate that file references are relative and resolve under project root.
6. Run secret scan over metadata and Markdown body.
7. Validate against `pass.schema.json`.
8. Write atomically to `.notch/passes/`.
9. Append exactly one audit event to `.notch/logs/audit.jsonl`.
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

## 3Notch Brief Behavior

A targeted brief is a durable, scoped handoff for a specific future task or agent. It differs from a pass because it is deliberate task packaging, not an end-of-session summary.

Creation:

- Human: `notch brief create` prompts or opens editor.
- Agent: MCP `create_brief` writes structured content supplied by the agent.
- 3Notch does not automatically reconstruct historical context in V1.

Scope declaration:

- `scope.topics`
- `scope.files`
- optional `scope.timeframe`

Exclusions declaration:

- `exclusions` is required and must state what not to include or rely on.
- Empty exclusions are allowed only if explicitly set to `[]`.

Relevant files:

- Stored as source links or scope file paths.
- 3Notch references files; it does not silently ingest file contents.
- A future `--include-file-content` feature is out of V1 unless explicitly added.

Historical reasoning:

- The creating human/agent summarizes prior reasoning in `priorReasoningSummary` and separately states the design basis in `designBasis`.
- 3Notch validates and stores the summary but does not judge correctness.

Retrieval:

- Humans use `notch brief list` and `notch brief show <id>`.
- Agents use `list_briefs` and `get_targeted_brief`.
- ID lookup supports exact ID or slug. Prefix matching is deferred to avoid ambiguous V1 behavior.

## Decision, Question, Stale, and Conflict Behavior

These records are intentionally thin in V1. They exist to satisfy the project continuity loop and context-health promise, not to become a project management system.

Decision records:

- Created with `notch decision add` or MCP `record_decision`.
- Stored under `.notch/decisions/`.
- Included in `notch brief`, `notch status`, and `get_status`.
- Agent-authored decisions default to `reviewStatus: "unreviewed"`.
- V1 does not require a separate review workflow; review state is metadata for humans and future tooling.

Open questions:

- Created with `notch question add` or MCP `add_open_question`.
- Listed with `notch question list` or MCP `get_open_questions`.
- Included in status counts and default project brief warnings.
- A question is unresolved while `status: "active"` and is removed from active lists when archived.

Stale marking:

- `notch stale mark <id>` and MCP `mark_context_stale` update an existing 3Notch source record to `status: "stale"`.
- The default project brief cannot be marked stale; edit `.notch/brief.md` directly instead.
- Records already marked `stale` or `superseded` are treated as no-ops with warnings, not rewritten.
- The command must preserve the original file, update `updatedAt`, append a short stale reason to the Markdown body, and write an audit entry.
- Stale marking is not deletion; stale records remain inspectable and can be used for provenance.

Conflict records:

- Created with `notch conflict add` or MCP `create_conflict` when two or more active records appear contradictory.
- All `conflictingRecords` IDs must be distinct.
- Listed with `notch conflict list` or MCP `list_conflicts`.
- Resolved with `notch conflict resolve <id>` or MCP `resolve_conflict`, which archives the conflict and records the resolution.
- V1 conflict detection is manual or agent-submitted. Automatic contradiction detection is future work.

## Status and Doctor Behavior

`notch status` reports:

- Project name and store path
- Latest pass
- Inbox packets from other repos
- Outbox packets created by this repo
- Private seed packets
- Open targeted briefs
- Active and unresolved decisions
- Open questions
- Active conflicts
- Stale handoffs
- Validation issue count
- Store health warnings

`notch doctor` validates:

- `.notch/` exists
- Required folders exist
- `config.json` is valid
- Markdown/YAML records parse
- Packet records in `inbox/`, `outbox/`, and `private/` parse
- Schemas pass
- IDs are unique
- Source file references resolve where possible
- Index is current or rebuildable
- Audit log is parseable
- Secret patterns are not obviously present
- MCP write tools match config
- Symlinks inside `.notch/` are rejected
- Source-link paths are relative and resolve under project root
- Imported packet origin links are preserved as origin metadata, not treated as local file writes
- `.notch/.gitignore` ignores `index/`, `logs/`, and `private/`

Store states:

- Healthy: config valid, records valid, index rebuildable, no critical issues.
- Stale: records are valid but old or source links are missing.
- Invalid: schema validation fails.
- Corrupted: files cannot parse, duplicate IDs exist, or index/log state cannot be read.

Suggested fix output:

```text
[error] RECORD_SCHEMA_INVALID .notch/passes/20260523T183000Z-codex-route-guard.md
Field: confidence
Fix: Set confidence to one of low, medium, high.

[warn] INDEX_STALE .notch/index/records.json
Fix: Run notch doctor --fix.
```

## Security and Privacy Considerations

- 3Notch is local-first and uses no telemetry by default.
- `.notch/` records stay on disk unless the user explicitly creates/imports a packet, copies a packet file, or later enables sync.
- Private seed packets live under `.notch/private/`, which is ignored by Git by default.
- `notch send` in V1 is a local filesystem copy/import helper, not a network delivery channel.
- MCP tools are scoped to the configured store.
- MCP cannot execute shell commands.
- MCP cannot read arbitrary project files by path; it reads 3Notch records, validates source references, and only `import_packet` may read an explicit packet file for import.
- MCP cannot read `.notch/private/` seed packets unless the user starts the server with `--include-private`.
- Writes are auditable through `.notch/logs/audit.jsonl`.
- Secret scanning runs before writes using configured redaction patterns.
- Suspected secrets should block writes by default unless an explicit future override is designed.
- File references may point to sensitive files, so 3Notch stores references, not automatic file contents.
- `sensitivity: private` is a storage/exposure rule, not encryption. Hosted encrypted sync is future work.
- Agent-written records default to unreviewed.
- Active decisions should be treated as constraints but not as unquestionable truth.

Path safety:

- All source file references in CLI flags, MCP inputs, `SourceLink.path`, and `scope.files` must be relative paths.
- After normalization, every referenced path must resolve under `config.project.root`.
- Absolute paths, home-directory paths, and traversal outside the project fail with `NOTCH_PATH_OUTSIDE_PROJECT`.
- Symlinks inside `.notch/` are rejected by `doctor` and must not be followed by read/write services.

Secret scanning:

- `redactPatterns` are JavaScript regular-expression source strings with optional flags.
- Default matching is case-insensitive.
- V1 also includes a high-entropy detector for likely API keys, JWTs, SSH private keys, and 32+ character token-like strings.
- On detection, write operations fail with `NOTCH_SECRET_DETECTED`; 3Notch should not store a redacted copy silently because the user may need to decide what context is safe to preserve.

Actor trust:

- CLI writes are human-authored by default; MCP writes are agent-authored by default.
- `--actor` and MCP `actorName` set only display names. `actorType` is derived from transport except for explicit CLI `--agent`.
- Agent-authored records default to `reviewStatus: "unreviewed"`.

## Error Handling

Error object shape:

```ts
interface NotchError {
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
error NOTCH_STORE_NOT_FOUND
No .notch store was found for this project.

Fix:
  Run notch onboard.
```

MCP error response format:

```json
{
  "isError": true,
  "content": [
    {
      "type": "text",
      "text": "NOTCH_STORE_NOT_FOUND: No .notch store was found for this project."
    }
  ],
  "data": {
    "code": "NOTCH_STORE_NOT_FOUND",
    "severity": "error",
    "recovery": "Run notch onboard in the project root."
  }
}
```

Common error codes:

```text
NOTCH_STORE_NOT_FOUND
NOTCH_CONFIG_INVALID
NOTCH_RECORD_INVALID
NOTCH_RECORD_NOT_FOUND
NOTCH_RECORD_ID_AMBIGUOUS
NOTCH_SCHEMA_VERSION_UNSUPPORTED
NOTCH_INDEX_STALE
NOTCH_INDEX_CORRUPT
NOTCH_PATH_OUTSIDE_STORE
NOTCH_PATH_OUTSIDE_PROJECT
NOTCH_SECRET_DETECTED
NOTCH_MCP_READ_ONLY
NOTCH_PERMISSION_DENIED
NOTCH_WRITE_FAILED
NOTCH_AUDIT_WRITE_FAILED
NOTCH_SOURCE_LINK_INVALID
NOTCH_SYMLINK_REJECTED
NOTCH_CORRUPT_RECORD
```

## Testing Strategy

- Unit tests for ID generation, slugging, path canonicalization, schema validation, Markdown/YAML parsing.
- Schema tests for valid and invalid config/pass/brief/decision fixtures.
- CLI tests using temporary directories for every V1 command.
- MCP tests for every tool with read-only and write-enabled modes.
- MCP protocol-conformance tests for `initialize`, `tools/list`, and `tools/call` using SDK in-memory transport.
- One smoke test against a real local MCP client harness or `mcp-cli` equivalent.
- Fixture tests using a Claude-to-Codex demo `.notch/` store.
- Corrupt store tests for bad YAML, duplicate IDs, missing config, broken audit logs, invalid schema versions.
- Snapshot/golden tests for `status`, `doctor`, `brief list`, and error output.
- Cross-platform path tests for Windows-style paths, spaces, symlink rejection, and path traversal attempts.
- Source-link path tests proving absolute paths and sibling-directory traversal are rejected.
- Cross-repo packet tests with two temp Git repos: create in repo A, import into repo B, list/show in repo B.
- Private seed tests with an old temp repo and a new temp repo: seed from old, import into new `.notch/private/inbox/`, verify Git ignore, and verify MCP hides it unless `--include-private` is used.
- `notch send --to <repo>` tests proving the shortcut writes source outbox and destination inbox.
- MCP packet tests proving `create_packet`, `import_packet`, `list_packets`, and `get_packet` work in one scoped store.
- Secret-scan tests for configured redaction patterns.
- Tests proving every successful write appends exactly one audit entry.
- Tests proving blocked secret writes append a `secret-blocked` audit entry without creating the source record.
- Schema-version mismatch tests for warnings vs failures.
- Derived index rebuild tests proving `index/` can be deleted and regenerated.

## Acceptance Criteria

- `npm install -g @3notch/cli` or `npx @3notch/cli onboard` works.
- `notch onboard` creates a valid `.notch/` store.
- Onboarding creates `.notch/.gitignore` that ignores `index/`, `logs/`, and `private/`.
- `notch doctor` reports healthy on a fresh store.
- `notch pass` creates a valid pass interactively and non-interactively.
- `get_latest_pass` returns the newest valid active pass.
- `get_recent_passes` returns the last 2-3 valid passes by default.
- MCP `get_brief` returns the default project brief from `.notch/brief.md`.
- `notch brief create`, `notch brief list`, and `notch brief show <id>` work.
- Targeted briefs can be filtered by title, tag, and target agent.
- MCP `create_brief`, `list_briefs`, and `get_targeted_brief` work.
- `notch packet create` writes a valid packet to `.notch/outbox/` and can write a portable file.
- `notch packet import <file>` validates a packet and copies it into another repo's `.notch/inbox/`.
- `notch packet list` and `notch packet show <id>` read imported and outbox packets.
- `notch send --to <repo-or-store-path>` creates a source outbox packet and imports/copies it to the destination.
- `notch seed from <repo-or-store-path>` creates or imports a private seed packet into `.notch/private/inbox/`.
- Private seed packets are ignored by Git by default.
- MCP `create_packet`, `import_packet`, `list_packets`, and `get_packet` work inside the scoped store.
- MCP packet read tools hide private seed packets unless `notch mcp serve --include-private` is used.
- Imported packets are readable by CLI and MCP before any source records are merged into the destination repo.
- `notch decision add` and `notch decision list` create and list valid decision records.
- MCP `record_decision` and `get_decisions` work.
- `notch question add` and `notch question list` create and list unresolved open questions.
- `notch stale mark <id>` marks records stale without deleting them.
- `notch conflict add`, `notch conflict list`, and `notch conflict resolve` work for basic conflict records.
- Decision, question, stale, and conflict records are validated and included in status.
- `notch status` shows latest pass, inbox/outbox packets, private seed packets, open briefs, open questions, active conflicts, unresolved decisions, stale records, and validation issues.
- `notch doctor` catches invalid records, invalid packets, private ignore misconfiguration, unsafe local paths, and can rebuild derived index state.
- `notch mcp serve` exposes the expected V1 tools.
- MCP write tools record actor, timestamp, source tool, record type, and schema version.
- MCP tools cannot access files outside `.notch/` except for the explicit packet file supplied to `import_packet`.
- CLI and MCP write tools reject source-link paths outside `config.project.root`.
- Every successful write produces exactly one entry in `.notch/logs/audit.jsonl`.
- Secret-blocked writes create no source record and append exactly one `secret-blocked` audit entry.
- README quickstart completes private context seeding plus a Claude-to-Codex style pass loop from a fresh clone.
- README quickstart includes one targeted brief creation/retrieval step.
- Demo fixtures are included.
- The Claude-to-Codex demo fixture passes `notch doctor` and proves `get_brief`, `get_recent_passes`, `create_pass`, and `create_brief`.
- No cloud dependency exists.
- No telemetry exists.
- Tests pass.

## Future Considerations

- Hosted encrypted sync
- Encrypted private seed packets at rest
- Team workspaces
- Managed MCP endpoint
- Browser UI
- Homebrew distribution
- SQLite FTS or another richer derived index after file-scan V1 proves insufficient
- Semantic/vector search
- LLM-assisted conflict detection
- Full `notch search <query>` command beyond V1 list/filter behavior
- Chat export importers
- Claude/Codex/Cursor-specific onboarding wizards
- Review/approval workflows
- Dedicated assumption record type
- Context health scoring
- Web landing page and demo video
- Enterprise audit, SSO, retention, and policy controls

## Open Questions

- None that block V1 implementation. Client-specific MCP config paths may change over time, so `notch onboard --mcp` must be implemented defensively: mutate only known config files after confirmation and otherwise print copy-pasteable instructions.
