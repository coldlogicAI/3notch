# Technical Specification: 3Notch V1 MVP

## Positioning

3Notch is a local-first CLI and MCP server for moving project context across boundaries that built-in AI tooling cannot cross: across repos, across AI work surfaces (Claude Desktop, Claude Code, Codex, Cursor, ChatGPT, local agents), and across the start of new projects.

The promise: **your AI tools will change; your project context shouldn't have to.**

V1 does three things and nothing else:

1. **Packet transfer.** Package selected, source-linked context from one repo/store into a portable Markdown/YAML file; import it into another repo/store.
2. **Private context seeding.** Carry user preferences and workflow conventions from a prior repo into a new repo's ignored `.notch/private/` namespace.
3. **Targeted briefs.** Produce a scoped task-context document an agent can read before work.

Everything else V1 ships (default project brief, status, doctor, MCP server, audit, secret scan, schema validation) exists to make those three loops safe, inspectable, and useful.

## Recommended Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | Node.js 20+ LTS | Fits `npx @3notch/cli onboard`, broad availability, MCP SDK support. |
| Language | TypeScript | Strong typed records, good CLI/MCP ecosystem fit. |
| CLI Framework | Commander | Small, scriptable, sufficient for V1. |
| Bundler | tsup | Lightweight TypeScript bundling for a distributable npm CLI. |
| Local Storage | Markdown + YAML frontmatter records, `config.json`, derived JSON manifest/index files | Records are inspectable. File-scan plus small JSON indexes avoid native SQLite install friction. |
| Schema Validation | JSON Schema + Ajv | Language-neutral validation for files and MCP inputs. |
| MCP Server | `@modelcontextprotocol/sdk` over stdio | Standard local MCP path; no hosted dependency. |
| Testing | Vitest, temp filesystem fixtures, execa-style CLI tests | Fast unit tests plus real command execution. |
| Packaging | npm package `@3notch/cli` with `bin.notch`; `npx @3notch/cli onboard` first | Matches positioning; zero-friction install path. |

## Product Principles

- Cross-boundary portability, not generic memory.
- Local files are the source of truth.
- Cross-repo and cross-tool transfer is first-class.
- Private context seeding is first-class.
- Agents and humans write structured, auditable records.
- Humans can inspect and edit stored context.
- CLI first; MCP second; no web dashboard in V1.
- Store only context supplied through explicit user/agent action — never hidden scraping.
- Private seed context is hidden from MCP unless explicitly enabled per server process.
- Every write is attributable: actor, timestamp, source tool, record type, schema version.
- Validation fails loudly with actionable fixes.
- Derived indexes must be rebuildable from source files.
- Every feature must answer: does this help context cross a boundary built-in tools can't cross?

## Architecture Decision

Assumptions:

- 3Notch runs inside one project repository by default, and V1 must support moving scoped packets between two local repos/stores and importing private seed context from prior work into a new repo.
- The default store is `<project>/.notch/`; a destination can be another Git repo root, another `.notch/` path, or a packet file imported later.
- Source-of-truth records must be readable in a text editor.
- Agents may generate imperfect context, so validation, attribution, and review status matter.
- V1 should demo new-project seeding from prior work and cross-tool/cross-repo handoff quickly.
- V1 supports Claude Desktop, Claude Code, Codex, Cursor, and ChatGPT through the local MCP server. Those clients provide selected context through explicit tool calls; 3Notch does not require privileged access to client internals.
- Claude Desktop DXT packaging is a likely follow-on distribution layer, not a V1 blocker.

Architecture: a TypeScript CLI package with a local file store, shared core services (config, store, schema, path-safety, record factory, audit, secret scan, index), a brief service, a packet service, a transfer service, a seed service, and an MCP adapter exposing the same capabilities. The CLI owns onboarding, human workflows, private context seeding, packet transfer, status, and doctor checks. The MCP server exposes constrained tools for agents to read/write 3Notch records inside the current store and to create/import packets when explicitly requested.

3Notch is not a SaaS, dashboard, vector database, chat archive, or orchestration layer in V1. V1 also avoids native SQLite: the expected store size is small enough for deterministic file scans, and `npx @3notch/cli onboard` should work without `node-gyp`, prebuilt binaries, or platform-specific install failures.

## Cross-Tool Handoff Model

The core product loop is explicit context handoff between AI work surfaces:

1. A user asks an agent in Claude Desktop, Claude Code, Codex, Cursor, ChatGPT, or another MCP-capable client to create or read a 3Notch packet.
2. The agent calls the local 3Notch MCP server or the user runs the CLI.
3. For writes, the caller supplies selected or summarized context, source links, exclusions, and next steps.
4. 3Notch validates and stores that content as a human-readable packet or brief.
5. Another repo or tool imports or reads the packet through CLI or MCP.

3Notch is a packet exchange layer. It does not need raw Claude Project database access, hidden chat export scraping, or automatic reconstruction of months of history. The agent with the relevant active context selects and summarizes what should move; 3Notch stores, validates, exposes, and transfers it safely.

V1 integration posture:

- Implement the local CLI and local stdio MCP server first.
- Support Claude Desktop and Claude Code through ordinary MCP configuration.
- Treat a Claude Desktop DXT package as the likely later packaging path.
- Treat remote MCP connectors as future hosted work.

## V1 Non-Goals

- Hosted SaaS
- Login, billing, accounts, or teams
- Browser extension
- Web dashboard
- Cloud sync
- Telemetry
- Vector database
- Semantic search dependency
- Hidden or automatic chat/project scraping
- Automatic historical reconstruction
- Agent orchestration
- Arbitrary shell execution through MCP
- Plugin marketplace
- Enterprise policy controls
- Background daemon beyond explicit `notch mcp serve`
- Session-end "pass" workflow (CLAUDE.md, native `/memory`, and `git commit` already solve same-repo same-tool session continuity)
- Decision, open-question, conflict, or stale-marking record types (these compete with CLAUDE.md and git for same-repo discipline that the community does not maintain in dedicated tools)

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
        packet.ts
        seed.ts
        status.ts
        doctor.ts
        mcp.ts
    core/
      config-service.ts
      store-service.ts
      schema-service.ts
      path-safety.ts
      id-service.ts
      actor-service.ts
      record-factory.ts
      markdown-service.ts
      record-parser.ts
      audit-service.ts
      secret-scan-service.ts
      index-service.ts
      brief-service.ts
      packet-service.ts
      transfer-service.ts
      seed-service.ts
      status-service.ts
      doctor-service.ts
    mcp/
      server.ts
      tool-schemas.ts
      tools/
        get-brief.ts
        create-brief.ts
        list-briefs.ts
        get-targeted-brief.ts
        create-packet.ts
        import-packet.ts
        list-packets.ts
        get-packet.ts
        create-seed-packet.ts
        import-seed-packet.ts
        get-status.ts
        run-doctor.ts
    schemas/
      shared.schema.json
      config.schema.json
      project-brief.schema.json
      brief.schema.json
      packet.schema.json
      audit.schema.json
      status.schema.json
      mcp-tools.schema.json
    templates/
      project-brief.md
      targeted-brief.md
      packet.md
    types/
      records.ts
      errors.ts
  tests/
    unit/
    schema/
    cli/
    mcp/
    e2e/
    fixtures/
    helpers/
  fixtures/
    cross-repo-demo/
    context-seed-demo/
    cross-tool-handoff-demo/
```

## Local 3Notch Store Layout

```text
.notch/
  .gitignore
  config.json
  brief.md
  briefs/
  inbox/
  outbox/
  private/
    inbox/
    outbox/
  index/
  logs/
```

### `.gitignore`

- Purpose: keep derived and noisy local files out of Git by default.
- Source of truth: no.
- Required V1 contents:

```gitignore
index/
logs/
private/
```

Records intended to be project-owned (`config.json`, `brief.md`, `briefs/`, `inbox/`, `outbox/`) stay Git-friendly. Personal workflow context and seed packets live under `private/`, which is ignored by default.

### `config.json`

- Project-level 3Notch configuration. Source of truth. Schema-validated against `config.schema.json`. Unknown top-level fields warn.

### `brief.md`

- Compact default project brief every agent can read before work. Schema-validated against `project-brief.schema.json`. Required body headings: `## Current Focus`, `## Active Constraints`, `## Recent Activity`, `## Open Threads`, `## Warnings`.

### `briefs/`

- Targeted handoff briefs for specific tasks, agents, features, or timeframes. Each `.md` file must satisfy `brief.schema.json`.

### `inbox/`

- Imported packets from other repos, people, or agent sessions. Each `.md` file must satisfy `packet.schema.json`. Import does not silently merge content into local source records.

### `outbox/`

- Packets created from this repo for transfer elsewhere. Each `.md` file must satisfy `packet.schema.json`.

### `private/`

- Private seed packets and user/workflow context imported into this repo. Local-private by default. Packet files under `private/inbox/` and `private/outbox/` must satisfy `packet.schema.json`. Ignored by Git. Not exposed by MCP unless the server is started with `--include-private`. `notch seed from <repo-or-store-path>` imports reviewed seed packets here.

### `index/`

- Derived lookup and status data. Not source of truth. Can be deleted and rebuilt with `notch doctor --fix`. Contents: `records.json` and `manifest.json`. V1 does not use SQLite or native dependencies.

### `logs/`

- Append-only audit log. JSONL parse validation; corrupted lines reported by `doctor`.

## Audit Log Format

Every write operation appends exactly one JSON object to `.notch/logs/audit.jsonl`. V1 uses one append-only file with no rotation. `doctor` validates every non-empty line against `audit.schema.json`.

```ts
type AuditOperation =
  | "create"
  | "import"
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

Audit writes are best-effort atomic: write the record first, append audit second. Surface `NOTCH_AUDIT_WRITE_FAILED` if the audit append fails.

## Data Model

`schemaVersion` is stored as a string and validated with `^\d+\.\d+\.\d+$`. YAML examples must quote it.

```ts
type RecordType = "config" | "project_brief" | "brief" | "packet";
type ActorType = "human" | "agent" | "system";
type ReviewStatus = "unreviewed" | "reviewed";
type RecordStatus = "draft" | "active" | "archived";
type PacketPurpose = "handoff" | "seed";
type Sensitivity = "project" | "private";

interface Actor {
  actorType: ActorType;
  name: string;
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

`updatedAt` is omitted on create-only records until they are changed.

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
    allowedMcpWriteTools: string[];
  };
}
```

### Project Brief

```ts
interface ProjectBrief extends RecordMeta {
  recordType: "project_brief";
  projectName: string;
  currentFocus: string[];
  activeConstraints: string[];
  recentActivity: string[];
  openThreads: string[];
  warnings: string[];
}
```

### Targeted Brief

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

A packet is the V1 transfer unit. It is a portable, inspectable Markdown/YAML artifact that can be copied, attached, committed, or directly imported into another `.notch/` store. It is not a network message and does not imply secrecy.

A seed packet is a packet with `purpose: "seed"` and `sensitivity: "private"`. It carries reviewed user/workflow context into a new repo and imports to `.notch/private/inbox/` by default. Private seed packets are local files, not encrypted secrets in V1; secret scanning applies.

### Project Status Summary

```ts
interface ProjectStatusSummary {
  schemaVersion: string;
  generatedAt: string;
  projectName: string;
  storePath: string;
  counts: {
    targetedBriefs: number;
    inboxPackets: number;
    outboxPackets: number;
    privateSeedPackets: number;
    validationIssues: number;
  };
  recentInboxPackets: Array<{ id: string; title: string; originProject?: string; importedAt?: string; summary: string }>;
  openBriefs: Array<{ id: string; title: string; targetAgent: string; tags: string[] }>;
  warnings: NotchError[];
}
```

## File Formats

Records use Markdown with YAML frontmatter. Frontmatter is schema-validated. The Markdown body is human-readable and must include required headings per record type.

### Default Project Brief

- Path: `.notch/brief.md`
- Required frontmatter fields: `id`, `schemaVersion`, `recordType`, `status`, `projectName`, `createdAt`, `updatedAt`, `createdBy`, `sourceTool`, `tags`, `sourceLinks`, `reviewStatus`
- Required body headings: `## Current Focus`, `## Active Constraints`, `## Recent Activity`, `## Open Threads`, `## Warnings`

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

## Active Constraints

- Use the Next.js app router.
- Keep auth local for V1.

## Recent Activity

- Auth refactor packet imported from planning repo on 2026-05-22.

## Open Threads

- Hosted sync passkeys vs OTP.

## Warnings

- None.
```

### 3Notch Config

- Path: `.notch/config.json`
- Required fields: `schemaVersion`, `project`, `store`, `privacy`, `defaults`
- Optional: `project.defaultBranch`
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
    "allowedMcpWriteTools": [
      "create_brief",
      "create_packet",
      "import_packet",
      "create_seed_packet",
      "import_seed_packet"
    ]
  }
}
```

### Targeted Brief

- Naming: `.notch/briefs/YYYYMMDDTHHMMSSZ-<slug>-for-<agent>.md`
- Required fields: `RecordMeta`, `title`, `targetAgent`, `goal`, `scope`, `exclusions`, `designBasis`, `priorReasoningSummary`
- Optional: `scope.timeframe`, `constraints`, `recommendedNextSteps`
- Required body headings: `## Goal For <Target Agent>`, `## Relevant Background`, `## Prior Reasoning Summary`, `## Design Basis`, `## Relevant Files And Sources`, `## Known Pitfalls`, `## Recommended Next Steps`

### Transfer Packet

- Outbox naming: `.notch/outbox/YYYYMMDDTHHMMSSZ-<slug>-to-<recipient>.md`
- Inbox naming: `.notch/inbox/YYYYMMDDTHHMMSSZ-<slug>-from-<project>.md`
- Private seed inbox naming: `.notch/private/inbox/YYYYMMDDTHHMMSSZ-<slug>-seed-from-<project>.md`
- Portable filename: `YYYYMMDDTHHMMSSZ-<slug>.notch.md`
- Required fields: `RecordMeta`, `title`, `purpose`, `sensitivity`, `transferStatus`, `origin`, `recipient`, `summary`, `includedRecords`
- Optional: `includedSourceLinks`, `importNotes`, `importedFrom`, `importedAt`, `privateContextSummary`
- Required body headings: `## Summary`, `## Recipient`, `## Origin`, `## Included Context`, `## Source Links`, `## Import Notes`
- Additional seed packet headings: `## User Preferences`, `## Workflow Conventions`, `## Lessons From Prior Work`, `## What Not To Carry Forward`

```md
---
id: packet_20260523T192000Z_marketing_repo_state
schemaVersion: "1.0.0"
recordType: packet
status: active
title: Current repo state for marketing copy basis
purpose: handoff
sensitivity: project
transferStatus: outbox
createdAt: 2026-05-23T19:20:00Z
createdBy:
  actorType: agent
  name: Claude Code
  actorSlug: claude-code
sourceTool:
  name: notch-mcp
  client: claude-code
tags: [marketing, current-state]
sourceLinks:
  - kind: file
    path: src/features/onboarding.ts
  - kind: file
    path: CHANGELOG.md
reviewStatus: unreviewed
origin:
  projectName: my-app
  storePath: /Users/example/my-app/.notch
  repoRoot: /Users/example/my-app
  branch: main
  commit: 4f2c1ab
recipient:
  targetAgent: claude
  targetPerson: marketing-author
summary: Snapshot of shipped features and current constraints for marketing copy work in Claude Desktop.
includedRecords: []
includedSourceLinks:
  - kind: file
    path: CHANGELOG.md
---

## Summary

Shipped features as of commit 4f2c1ab: route guard, onboarding flow, magic-link auth (no passwords yet). Constraint: local auth only, no hosted sync.

## Recipient

Claude Desktop session writing marketing copy.

## Origin

Created from my-app on main at commit 4f2c1ab.

## Included Context

- CHANGELOG.md shipped-features list

## Source Links

- `src/features/onboarding.ts`
- `CHANGELOG.md`

## Import Notes

Use this as the source of truth for "what shipped" claims in marketing copy. Do not promise hosted sync.
```

### Path Safety Distinction

`origin.repoRoot`, `origin.storePath`, and `includedSourceLinks` may contain absolute paths from the source repo. These are stored as metadata for human inspection. They are not write targets. Destination import paths and all writable file references use strict relative-path validation per the Path Safety section.

## Schema Validation

- Schema location: `src/schemas/*.schema.json`, packaged with the CLI.
- Validation library: Ajv strict mode.
- Runtime validation:
  - All writes validate before saving.
  - All reads validate before returning data to CLI or MCP.
  - `brief.md` validates against `project-brief.schema.json`.
  - `audit.jsonl` validates line-by-line against `audit.schema.json`.
  - `doctor` validates every file in `.notch/`.
  - Invalid records are excluded from normal status/list unless `--include-invalid` is added later.
- Error format: structured `NotchError` objects with code, message, path, field, severity, recovery guidance.
- Schema versions: V1 writes `schemaVersion: "1.0.0"`. YAML examples must quote `schemaVersion`. Parsers may coerce scalar versions to strings. Patch/minor-compatible versions may warn. Major mismatches fail.
- Tag rules: lowercase kebab-case, matching `^[a-z0-9][a-z0-9-]{0,63}$`. Duplicates removed during normalization. Invalid tags fail validation.
- Migration posture: no automatic destructive migrations in V1. `doctor` may recommend migration but must not alter source records without explicit request.

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
- `--actor` sets only display name.
- `--agent` on CLI writes sets `actorType: "agent"` and `reviewStatus: "unreviewed"`.
- If `--actor` is omitted, resolve display name from `git config user.name`, then `$USER` or `$USERNAME`, then `"unknown"`.
- Audit entries record separate actor display-name and actor-type resolution sources.

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
- Usage: `notch onboard [--name <project>] [--yes] [--mcp <client>] [--force] [--json]`
- Flags: `--name`, `--yes`, `--mcp claude-desktop|claude-code|codex|cursor|chatgpt-desktop|none`, `--force` (repair missing starter files only)
- Interactive behavior: detects Git root; asks whether to create `.notch/`, starter brief, `.notch/.gitignore`, and optional MCP config instructions.
- Non-interactive behavior: `--yes` creates default config and starter files.
- MCP setup: for `claude-desktop` and `cursor`, may update known local MCP config files only after explicit confirmation. For `claude-code`, `codex`, and `chatgpt-desktop`, V1 prints copy-pasteable instructions because client config locations vary. All MCP setup output includes the equivalent `notch mcp serve --store <path>` command.
- Existing store: a complete store is left unchanged; without `--force`, onboarding exits with an already-initialized message. With `--force`, only missing folders and starter files are repaired. V1 never migrates schemas or rewrites existing source records silently.
- Error cases: partial store without `--force`, root not writable, invalid project name, MCP config path unsupported.
- Exit codes: `0`, `1`, `5`, `10`.
- Example: `npx @3notch/cli onboard --name my-app --yes`

### `notch brief`

- Purpose: show compact default project brief.
- Usage: `notch brief [--json]`
- Output: Markdown/text or JSON.
- Error cases: store missing, brief missing, `project-brief.schema.json` validation failed.
- Exit codes: `0`, `2`, `3`.

### `notch brief create`

- Purpose: create a targeted brief.
- Usage: `notch brief create [options]`
- Flags: `--title`, `--to <agent>`, `--goal`, `--topic` (repeatable), `--file` (repeatable), `--exclude` (repeatable), `--tag` (repeatable), `--slug`, `--stdin`, `--editor`, `--json`
- Interactive: prompts for title, target agent, goal, scope, exclusions, content sections.
- Non-interactive: required fields supplied via flags or stdin.
- Output: brief ID/path; JSON if requested.
- Error cases: missing target agent, missing goal, invalid scope path, path outside project root, secret detected, schema invalid. Slug collisions auto-suffix `-2`, `-3` unless `--slug` is supplied, in which case collision is an error.
- Exit codes: `0`, `1`, `2`, `5`.
- Example: `notch brief create --title "March training feature" --to codex --goal "Implement March training updates" --file src/training --exclude "Billing"`

### `notch brief list`

- Purpose: list targeted briefs.
- Usage: `notch brief list [--tag <tag>] [--to <agent>] [--status <status>] [--since <date>] [--limit <n>] [--json]`
- Output: ID, title, target agent, tags, status, created date.
- Exit codes: `0`, `2`, `3`.

### `notch brief show <id>`

- Purpose: show a targeted brief by ID or slug.
- Usage: `notch brief show <id> [--json] [--metadata]`
- Output: Markdown by default; JSON if requested. `--metadata` includes validated frontmatter before the body.
- Error cases: not found, invalid record.
- Exit codes: `0`, `1`, `2`, `3`.

### `notch packet create`

- Purpose: package selected source-linked context from the current store into a portable transfer packet.
- Usage: `notch packet create [options]`
- Flags:
  - `--title <title>`
  - `--to-agent <agent>`
  - `--to-person <name>`
  - `--to-repo <path-or-name>`
  - `--task <text>`
  - `--summary <text>`
  - `--purpose handoff|seed`
  - `--private` shorthand for `--purpose seed --sensitivity private`
  - `--sensitivity project|private`
  - `--include <record-ref>` repeatable: `brief:<id>` or `file:<relative-path>`
  - `--file <path>` repeatable shorthand for `--include file:<path>`
  - `--out <path>` write an additional portable packet file outside `.notch/outbox/`
  - `--stdin`, `--editor`, `--json`
- Interactive: prompts for recipient, destination repo if known, task, summary, included records, included files, next steps.
- Non-interactive: required title/recipient/summary via flags or stdin. At least one included record, file, or body section required.
- Output: created packet ID, outbox path, optional external output path, sensitivity, warnings; JSON if requested.
- Store behavior: project packets write to `.notch/outbox/`. Private packets write to `.notch/private/outbox/`. `--out` writes a second portable copy after validation.
- Error cases: missing recipient, missing summary/content, invalid include reference, file path outside origin project root, destination path unsafe, secret detected, schema invalid, write denied.
- Exit codes: `0`, `1`, `2`, `3`, `5`.
- Example: `notch packet create --title "Auth handoff" --to-agent codex --to-repo ../api --include brief:auth-refactor --file src/auth.ts --summary "Carry auth context into the API repo"`

### `notch packet import <file>`

- Purpose: validate a portable packet and copy it into a destination inbox.
- Usage: `notch packet import <file> [--into <repo-or-store-path>] [--as-reviewed] [--private] [--json]`
- Flags: `--into` (imports into another local repo/store), `--as-reviewed`, `--private` (forces import into `.notch/private/inbox/` regardless of packet sensitivity), `--json`
- Interactive: confirms destination store if importing outside the current repo and warns before importing a packet with schema warnings.
- Non-interactive: validates input file, resolves destination, copies to `inbox/` or `private/inbox/`, writes audit entry, rebuilds derived index.
- Output: imported packet ID/path, origin project metadata, destination store, warnings; JSON if requested.
- Store behavior: import does not merge content, overwrite existing records, or rewrite origin source links. If a packet ID or filename collides, suffix the inbox filename and preserve the original packet ID plus import metadata. Packets with `sensitivity: private` import to `.notch/private/inbox/` by default.
- Cross-repo destination policy: `--into` accepts a destination that is (a) the root of a Git repo containing a `.notch/config.json`, or (b) a directory containing a `.notch/config.json`. Destinations without an existing 3Notch store are rejected unless `--init` is added in a future version. This prevents accidental writes into unrelated directories.
- Error cases: file missing, packet schema invalid, destination store missing, destination not writable, secret detected, symlink/traversal issue.
- Exit codes: `0`, `1`, `2`, `3`, `5`.

### `notch packet list`

- Purpose: list inbox and outbox packets.
- Usage: `notch packet list [--inbox] [--outbox] [--private] [--to <recipient>] [--from <project>] [--purpose <purpose>] [--since <date>] [--limit <n>] [--json]`
- Defaults to both directions unless a direction flag is supplied. `--private` includes `.notch/private/`.
- Output: ID, title, direction, origin project, recipient, created/imported date, summary.
- Exit codes: `0`, `2`, `3`.

### `notch packet show <id>`

- Purpose: show an imported or outbox packet by ID, slug, or filename stem.
- Usage: `notch packet show <id> [--inbox] [--outbox] [--json] [--metadata]`
- Output: Markdown by default; JSON if requested.
- Error cases: not found, ambiguous ID across inbox/outbox, invalid packet.
- Exit codes: `0`, `1`, `2`, `3`.

### `notch seed from <repo-or-store-path>`

- Purpose: bootstrap a new repo with reviewed private context from prior work.
- Usage: `notch seed from <repo-or-store-path> [--include <category>] [--file <path>] [--review] [--out <path>] [--json]`
- Flags: `--include profile|preferences|workflow|conventions|lessons|prompts` (repeatable), `--file` (repeatable), `--review` (open generated seed packet for review before import), `--out` (write portable private seed packet without importing), `--json`
- Interactive: asks what prior context should carry forward, generates a seed packet draft, opens it in `$EDITOR` for review when `--review` is used, then imports.
- Non-interactive: reads a prior `.notch/` store or explicitly provided files, creates a packet with `purpose: "seed"` and `sensitivity: "private"`, and imports it into the current repo's `.notch/private/inbox/`.
- Review mechanism: `--review` always opens `$EDITOR` on the generated draft and requires save-and-close before write. Without `--review`, V1 still requires interactive confirmation when an actual TTY is available; non-interactive runs without `--review` require `--yes` (future flag) and are rejected in V1 to prevent silent private seeding.
- Store behavior: never writes seed packets to normal `.notch/inbox/`. Does not merge user preferences into public project records.
- MCP behavior: imported seed packets remain hidden from MCP unless the server is started with `--include-private`.
- V1 boundary: no hidden scraping. V1 uses prior `.notch/` stores, explicit user-selected files, and context supplied through a user-invoked action.
- Error cases: source store missing, no includable context, review not completed, secret detected, destination private inbox not writable, source path unsafe.
- Exit codes: `0`, `1`, `2`, `3`, `5`.
- Example: `notch seed from ../iPSM --include preferences --include workflow --include lessons --review`

### `notch status`

- Purpose: summarize current 3Notch project state.
- Usage: `notch status [--json]`
- Output: project name, store path, counts (targeted briefs, inbox packets, outbox packets, private seed packets, validation issues), recent inbox packets, open briefs, warnings.
- Exit codes: `0` if usable, `6` if validation warnings in strict CI mode, `2`, `3`.

### `notch doctor`

- Purpose: validate and repair safe derived store state.
- Usage: `notch doctor [--json] [--fix] [--yes] [--strict]`
- Flags: `--fix` (rebuilds index and creates missing derived folders only), `--yes` (applies safe fixes without prompting when used with `--fix`), `--strict` (treats warnings as failures), `--json`
- Output: checks, severity, affected path, suggested fix.
- Validation scope: validates `.notch/inbox/`, `.notch/outbox/`, `.notch/private/` packet schemas, packet ID collisions, import metadata, destination store layout, private ignore rules, and derived packet index state.
- Path-link distinction: origin source links inside imported packets may reference files outside the destination repo. Doctor warns on missing origin references when useful, but does not treat origin references as destination path traversal. Local write paths and destination import paths still use strict traversal and symlink checks.
- Exit codes: `0` healthy, `6` warnings in strict mode, `1` unhealthy, `2` missing store, `3` corrupted store, `5` permission.

### `notch mcp serve`

- Purpose: start the local MCP server.
- Usage: `notch mcp serve [--store <path>] [--read-only] [--include-private] [--default-actor <name>] [--log-file <path>]`
- `--read-only` disables all write tools.
- `--include-private` exposes `.notch/private/` seed packets to packet read tools for this process.
- Output: MCP protocol messages on stdio; logs on stderr or the configured log file.
- Exit codes: `0`, `2`, `3`, `4`, `5`.

## MCP Tool Specification

All MCP tools are scoped to the resolved `.notch/` store. They reject path traversal, arbitrary filesystem access, broad project file reads, and shell execution. The only V1 exception is `import_packet` and `import_seed_packet`, which may read exactly the user-supplied packet file path after path-safety validation. Private seed packets under `.notch/private/` are hidden unless `notch mcp serve --include-private` is used. Tool `inputSchema` values are real JSON Schemas loaded from `src/schemas/mcp-tools.schema.json`. MCP writes follow actor trust rules in Security and Privacy and are disabled when `--read-only` is active or `config.defaults.allowedMcpWriteTools` is empty.

### `get_brief`

- Purpose: return the default project brief from `.notch/brief.md`; the cold-start tool agents call before work.
- Input: `{ includeMarkdown?: boolean }`
- Output: `{ brief: ProjectBrief, markdown?: string, statusCounts: ProjectStatusSummary["counts"], warnings: NotchError[] }`
- Read.
- Security: reads only `.notch/brief.md` and derived status counts.

### `create_brief`

- Purpose: write a targeted brief.
- Input: `{ actorName?: string, title: string, targetAgent: string, goal: string, scope: { topics: string[], files: string[], timeframe?: string }, exclusions: string[], relevantFiles?: SourceLink[], designBasis: string, priorReasoningSummary: string, constraints?: string[], recommendedNextSteps?: string[], tags?: string[] }`
- Output: `{ id: string, path: string, createdAt: string, warnings: NotchError[] }`
- Write.
- Security: writes only under `.notch/briefs/`; all file paths must be relative and resolve under `config.project.root`.

### `list_briefs`

- Purpose: list targeted briefs.
- Input: `{ targetAgent?: string, tags?: string[], status?: RecordStatus, since?: string, limit?: number }`
- Output: `{ briefs: Array<{ id: string, title: string, goal: string, targetAgent: string, tags: string[], status: RecordStatus, createdAt: string }> }`
- Read.

### `get_targeted_brief`

- Purpose: read a targeted brief by ID or slug.
- Input: `{ id: string, includeMarkdown?: boolean }`
- Output: `{ brief: NotchBrief, markdown?: string, warnings: NotchError[] }`
- Read. No arbitrary path input.

### `create_packet`

- Purpose: package scoped context from the current store into a portable packet.
- Input: `{ actorName?: string, title: string, purpose?: PacketPurpose, sensitivity?: Sensitivity, toAgent?: string, toPerson?: string, toRepo?: string, task?: string, summary: string, include?: PacketRecordRef[], sourceLinks?: SourceLink[], importNotes?: string, outputPath?: string }`
- Output: `{ id: string, outboxPath: string, outputPath?: string, createdAt: string, warnings: NotchError[] }`
- Write.
- Security: writes project packets to `.notch/outbox/` and private packets to `.notch/private/outbox/`, plus an explicit `outputPath` when supplied. Included local file links must resolve under the origin project root. `outputPath` must pass safe destination path checks and cannot be a symlink target inside `.notch/`. Stores context supplied in tool input; does not read raw chat/project data from the client.
- Summary length warning: emits a non-fatal `NOTCH_SUMMARY_LARGE` warning when `summary` exceeds 5000 characters and no `include`/`sourceLinks` are supplied, to discourage agents from dumping raw transcripts.

### `import_packet`

- Purpose: validate a portable packet and copy it into the current store's inbox.
- Input: `{ actorName?: string, packetPath: string, asReviewed?: boolean }`
- Output: `{ id: string, inboxPath: string, importedAt: string, originProject?: string, warnings: NotchError[] }`
- Write.
- Security: reads exactly the supplied packet file and writes only `.notch/inbox/` or `.notch/private/inbox/`, audit log, and derived index files. MCP import targets the current store only; cross-store imports use the CLI.
- `importedFrom` sanitization: V1 stores the source filename only (basename), not the full absolute path, to avoid leaking host filesystem layout into the destination repo. The full path is retained in the audit log only.

### `list_packets`

- Purpose: list imported and outbox packets.
- Input: `{ direction?: "inbox" | "outbox" | "both", includePrivate?: boolean, purpose?: PacketPurpose, to?: string, fromProject?: string, since?: string, limit?: number }`
- Output: `{ packets: Array<{ id: string, title: string, direction: "inbox" | "outbox", originProject?: string, recipient?: string, createdAt: string, importedAt?: string, summary: string }>, warnings: NotchError[] }`
- Read. Reads `.notch/private/` only when both `includePrivate` is true and the MCP server was started with `--include-private`.
- Defaults: `direction` defaults to `"both"`. `limit` defaults to `10` with max `50`.

### `get_packet`

- Purpose: read an imported or outbox packet by ID or slug.
- Input: `{ id: string, direction?: "inbox" | "outbox" | "both", includePrivate?: boolean, includeMarkdown?: boolean }`
- Output: `{ packet: NotchPacket, markdown?: string, warnings: NotchError[] }`
- Read. No arbitrary path input.

### `create_seed_packet`

- Purpose: create a private seed packet from reviewed user/workflow context.
- Input: `{ actorName?: string, title: string, sourceStorePath?: string, summary: string, userPreferences?: string[], workflowConventions?: string[], lessons?: string[], prompts?: string[], sourceLinks?: SourceLink[], outputPath?: string }`
- Output: `{ id: string, privateOutboxPath: string, outputPath?: string, createdAt: string, warnings: NotchError[] }`
- Write.
- Security: writes only `.notch/private/outbox/` plus explicit `outputPath`. Cannot scan arbitrary source repos or client chat/project databases; callers must provide selected context or use CLI `notch seed from`.

### `import_seed_packet`

- Purpose: import a private seed packet into the current store's private inbox.
- Input: `{ actorName?: string, packetPath: string, asReviewed?: boolean }`
- Output: `{ id: string, privateInboxPath: string, importedAt: string, originProject?: string, warnings: NotchError[] }`
- Write.
- Security: reads exactly the supplied packet file and writes only `.notch/private/inbox/`, audit log, and derived index files. Does not merge preferences into public project records.

### `get_status`

- Purpose: return current 3Notch status summary.
- Input: `{ includeWarnings?: boolean }`
- Output: `ProjectStatusSummary`
- Read.

### `run_doctor`

- Purpose: validate 3Notch store.
- Input: `{ strict?: boolean, fixDerivedState?: boolean }`
- Output: `{ healthy: boolean, checks: DoctorCheck[], errors: NotchError[] }`
- Read by default; may rebuild `index/` only when `fixDerivedState` is true and the server is not in read-only mode.

## Core Services

| Service | File path | Inputs | Outputs | Key functions |
|---------|-----------|--------|---------|---------------|
| Config service | `src/core/config-service.ts` | cwd/store path | `NotchConfig` | resolve store, read/write config, validate |
| Store service | `src/core/store-service.ts` | record type, paths | parsed records/files | canonicalize paths, atomic write, file scan, slug collision handling |
| Schema service | `src/core/schema-service.ts` | object/schema ID | validated data | load schemas, validate records, format errors |
| Path safety | `src/core/path-safety.ts` | paths | normalized paths / errors | reject absolute paths, `~`, traversal, symlinks; separate origin-link helper |
| Record factory | `src/core/record-factory.ts` | command input | record with metadata | generate ID, slug, filename, actor, source tool, schema version |
| Record parser | `src/core/record-parser.ts` | file contents | parsed metadata + body | parse YAML frontmatter, coerce schemaVersion, validate headings |
| Audit service | `src/core/audit-service.ts` | write operation | JSONL audit entry | append-only writes, structured failure on append error |
| Secret scan | `src/core/secret-scan-service.ts` | record content | pass / block | configured regexes + high-entropy detection |
| Index service | `src/core/index-service.ts` | source files | `records.json`, `manifest.json` | derive, rebuild, drop and regenerate |
| Brief service | `src/core/brief-service.ts` | brief input/filter | default + targeted briefs | render default brief, create/list/get targeted briefs |
| Packet service | `src/core/packet-service.ts` | packet input/filter | `NotchPacket` records | create, list inbox/outbox, get, validate body |
| Transfer service | `src/core/transfer-service.ts` | packet files, destination paths | imported/copied packets | import, preserve origin metadata, sanitize `importedFrom`, cross-store destination check |
| Seed service | `src/core/seed-service.ts` | prior store path, include categories | private seed packets | create/import seed, enforce review, write private inbox/outbox |
| Status service | `src/core/status-service.ts` | store records | `ProjectStatusSummary` | counts, recent inbox packets, open briefs, warnings |
| Doctor service | `src/core/doctor-service.ts` | store path/config | diagnostics | validate structure, schemas, derived indexes, links, secrets, symlinks |
| MCP adapter | `src/mcp/server.ts` | MCP requests | MCP responses | register tools, enforce read-only / private exposure, wrap `NotchError` |
| CLI adapter | `src/cli/index.ts` | argv/stdin | stdout/stderr/exit code | parse commands, call services, format output |

## Packet Behavior

Creation:

- CLI: `notch packet create` prompts or opens editor.
- MCP: `create_packet` writes structured content supplied by the agent.
- 3Notch does not automatically reconstruct historical context. Selection of what goes in the packet is the caller's job.

Required input:

- `title`
- `summary`
- at least one of: `include` (record refs), `sourceLinks` (file/url refs), or body sections beyond the required headings

Recipient input:

- at least one of `toAgent`, `toPerson`, `toRepo` for `purpose: handoff`
- `recipient` may be empty for `purpose: seed`

Defaults:

- `purpose` defaults to `handoff`
- `sensitivity` defaults to `project`
- `--private` sets `purpose: seed` and `sensitivity: private`

Writes:

- `purpose: handoff` and `sensitivity: project` → `.notch/outbox/`
- `purpose: seed` or `sensitivity: private` → `.notch/private/outbox/`
- `--out <path>` → additional portable copy after validation
- Slug collisions auto-suffix with `-2`, `-3`, etc.

Import:

- Validates packet schema and required body headings.
- Writes to `.notch/inbox/` or `.notch/private/inbox/` (private if `sensitivity: private` or `--private`).
- Preserves `origin` metadata as-is.
- Stores `importedFrom` as the basename of the source file. Full source path is retained in the audit log.
- Does not merge packet contents into local source records.

## Seed Behavior

Seed packets carry private workflow/preference context across new repos. They differ from project packets because they encode personal working style, not project state.

Creation:

- CLI: `notch seed from <repo-or-store-path>` reads the prior `.notch/` and explicit files, generates a seed packet draft, requires review.
- MCP: `create_seed_packet` accepts explicit user-supplied content; cannot scan source repos.

Review:

- `--review` opens `$EDITOR` on the draft and requires save-and-close before write.
- Interactive runs without `--review` still confirm before write when a TTY is available.
- Non-interactive runs without explicit `--review` are rejected in V1 to prevent silent private seeding. A future `--yes` flag may relax this.

Storage:

- Always writes to `.notch/private/outbox/` (creation) or `.notch/private/inbox/` (import).
- Never writes to public folders.
- Never merges into project records.

MCP exposure:

- Hidden by default.
- `notch mcp serve --include-private` enables seed packets in `list_packets` and `get_packet` for the server process.

V1 boundary: no scraping. Selection is explicit, supplied by the user or by an agent invoked by the user.

## Brief Behavior

A default project brief lives at `.notch/brief.md` and is the cold-start primer agents read before work. It is created by `notch onboard` and edited by the user or by agents that update it as part of normal work.

A targeted brief is a durable, scoped handoff for a specific future task or agent. It differs from a packet because it stays in the current repo and does not carry transport metadata.

Creation:

- Human: `notch brief create` prompts or opens editor.
- Agent: MCP `create_brief` writes structured content supplied by the agent.

Required fields: `targetAgent`, `goal`, `scope`, `exclusions`, `designBasis`, `priorReasoningSummary`. Empty exclusions allowed only when explicitly stored as `[]`.

Files: stored as source links or scope file paths. V1 does not ingest file contents.

Retrieval: humans use `notch brief list` and `notch brief show <id>`. Agents use `list_briefs` and `get_targeted_brief`. ID lookup supports exact ID or slug.

## Status and Doctor Behavior

`notch status` reports:

- Project name and store path
- Counts: targeted briefs, inbox packets, outbox packets, private seed packets, validation issues
- Recent inbox packets (top 5)
- Open targeted briefs (top 10)
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
- Imported packet origin links are preserved as metadata, not treated as local file writes
- `.notch/.gitignore` ignores `index/`, `logs/`, and `private/`

Store states: healthy, stale (records valid but source links missing), invalid (schema validation fails), corrupted (files cannot parse, duplicate IDs, or index/log state unreadable).

## Security and Privacy Considerations

- 3Notch is local-first and uses no telemetry by default.
- `.notch/` records stay on disk unless the user explicitly creates/imports a packet, copies a packet file, or later enables sync.
- Private seed packets live under `.notch/private/`, ignored by Git by default.
- Cross-tool handoff is explicit: an AI client supplies selected/summarized context through CLI or MCP, and 3Notch writes an inspectable artifact. 3Notch does not silently read Claude Project data, raw chat logs, or other client internals.
- MCP tools are scoped to the configured store.
- MCP cannot execute shell commands.
- MCP cannot read arbitrary project files by path. Only `import_packet` and `import_seed_packet` may read an explicit packet file for import.
- MCP cannot read `.notch/private/` seed packets unless the user starts the server with `--include-private`.
- Writes are auditable through `.notch/logs/audit.jsonl`.
- Secret scanning runs before writes using configured redaction patterns and a high-entropy detector.
- Suspected secrets block writes by default.
- File references may point to sensitive files; 3Notch stores references, not file contents.
- `sensitivity: private` is a storage/exposure rule, not encryption. Hosted encrypted sync is future work.
- Agent-written records default to unreviewed.

### Path Safety

- All source file references in CLI flags, MCP inputs, `SourceLink.path`, and `scope.files` must be relative paths.
- After normalization, every referenced path must resolve under `config.project.root`.
- Absolute paths, home-directory paths, and traversal outside the project fail with `NOTCH_PATH_OUTSIDE_PROJECT`.
- Symlinks inside `.notch/` are rejected by `doctor` and must not be followed by read/write services.
- `origin.*` metadata in imported packets is exempt from project-root checks; it is preserved as metadata, never used as a write target.

### Secret Scanning

- `redactPatterns` are JavaScript regular-expression source strings with optional flags.
- Default matching is case-insensitive.
- V1 includes a high-entropy detector for likely API keys, JWTs, SSH private keys, and 32+ character token-like strings.
- On detection, write operations fail with `NOTCH_SECRET_DETECTED`. 3Notch does not store a redacted copy.

### Actor Trust

- CLI writes are human-authored by default; MCP writes are agent-authored by default.
- `--actor` and MCP `actorName` set only display names. `actorType` is derived from transport except for explicit CLI `--agent`.
- Agent-authored records default to `reviewStatus: "unreviewed"`.

## Error Handling

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

CLI display:

```text
error NOTCH_STORE_NOT_FOUND
No .notch store was found for this project.

Fix:
  Run notch onboard.
```

MCP error response:

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
NOTCH_PACKET_DESTINATION_INVALID
NOTCH_SEED_REVIEW_REQUIRED
NOTCH_SUMMARY_LARGE
```

## Testing Strategy

- Unit tests for ID generation, slugging, path canonicalization, schema validation, Markdown/YAML parsing.
- Schema tests for valid and invalid config/brief/packet/audit fixtures.
- CLI tests using temporary directories for every V1 command.
- MCP tests for every tool with read-only and write-enabled modes.
- MCP protocol-conformance tests for `initialize`, `tools/list`, and `tools/call` using SDK in-memory transport.
- One smoke test against a real local MCP client harness or `mcp-cli` equivalent.
- Cross-repo packet tests with two temp Git repos: create in repo A, import into repo B, list/show in repo B.
- Private seed tests with an old temp repo and a new temp repo: seed from old, import into new `.notch/private/inbox/`, verify Git ignore, verify MCP hides it unless `--include-private` is used.
- MCP packet tests proving `create_packet`, `import_packet`, `list_packets`, and `get_packet` work in one scoped store.
- Corrupt store tests for bad YAML, duplicate IDs, missing config, broken audit logs, invalid schema versions.
- Snapshot/golden tests for `status`, `doctor`, `brief list`, `packet list`, and error output.
- Cross-platform path tests for Windows-style paths, spaces, symlink rejection, path traversal attempts, and drive-letter rejection.
- Source-link path tests proving absolute paths and sibling-directory traversal are rejected, while origin-link paths in imported packets are preserved unchanged.
- Secret-scan tests for configured regex patterns and high-entropy detection.
- Tests proving every successful write appends exactly one audit entry.
- Tests proving blocked secret writes append a `secret-blocked` audit entry without creating the source record.
- Tests proving `notch send` does not exist as a command (regression guard against re-adding deferred surface).
- Tests proving `--agent` flag sets `actorType: agent` and `reviewStatus: unreviewed` on CLI writes.
- Telemetry-denylist test inspecting `package.json`, `package-lock.json`, source, and built output for common analytics packages.
- Schema-version mismatch tests for warnings vs failures.
- Derived index rebuild tests proving `index/` can be deleted and regenerated.
- `importedFrom` sanitization tests proving the absolute source path is not stored in the destination record.
- Cross-store destination tests proving `notch packet import --into <path>` rejects destinations without an existing 3Notch store.
- Seed review tests proving non-interactive runs without `--review` are rejected.

## Acceptance Criteria

- `npm install -g @3notch/cli` or `npx @3notch/cli onboard` works.
- `notch onboard` creates a valid `.notch/` store with `.gitignore` ignoring `index/`, `logs/`, and `private/`.
- `notch doctor` reports healthy on a fresh store.
- MCP `get_brief` returns the default project brief from `.notch/brief.md`.
- `notch brief create`, `notch brief list`, and `notch brief show <id>` work; briefs are filterable by tag and target agent.
- MCP `create_brief`, `list_briefs`, and `get_targeted_brief` work.
- `notch packet create` writes a valid packet to `.notch/outbox/` and can write a portable file via `--out`.
- `notch packet import <file>` validates a packet and copies it into another repo's `.notch/inbox/`.
- `notch packet import --into <repo>` rejects destinations without an existing `.notch/config.json`.
- `notch packet list` and `notch packet show <id>` read imported and outbox packets.
- `notch seed from <repo-or-store-path>` creates or imports a private seed packet into `.notch/private/inbox/` only after review.
- Private seed packets are ignored by Git by default.
- MCP `create_packet`, `import_packet`, `list_packets`, `get_packet`, `create_seed_packet`, and `import_seed_packet` work inside the scoped store.
- MCP packet read tools hide private seed packets unless `notch mcp serve --include-private` is used.
- Imported packets are readable by CLI and MCP without merging into destination source records.
- `notch status` shows counts, recent inbox packets, open briefs, and warnings.
- `notch doctor` catches invalid records, invalid packets, private ignore misconfiguration, unsafe local paths, and can rebuild derived index state.
- `notch mcp serve` exposes the expected V1 tools.
- MCP write tools record actor, timestamp, source tool, record type, and schema version.
- MCP tools cannot access files outside `.notch/` except for the explicit packet file supplied to `import_packet` or `import_seed_packet`.
- MCP packet writes from Claude Desktop/Claude Code/Codex accept explicit tool input only; no hidden chat/project scraping.
- CLI and MCP write tools reject source-link paths outside `config.project.root`.
- Every successful write produces exactly one entry in `.notch/logs/audit.jsonl`.
- Secret-blocked writes create no source record and append exactly one `secret-blocked` audit entry.
- `importedFrom` in destination records stores only the source filename basename, not the absolute path.
- README quickstart completes private context seeding plus a Claude Desktop → Claude Code packet handoff from a fresh clone.
- A cross-tool handoff smoke test proves an MCP caller can create a packet from explicitly supplied session context, another store can import it, and no hidden chat/project scraping is required.
- Demo fixtures are included for cross-repo, context-seed, and cross-tool-handoff.
- All demo fixtures pass `notch doctor`.
- No cloud dependency exists.
- No telemetry exists; telemetry-denylist test passes against `package.json`, lock file, source, and built output.
- CI runs lint, type-check, build, unit tests, and e2e tests across Ubuntu, macOS, and Windows on Node 20 and 22.
- Tests pass.

## Future Considerations

- Hosted encrypted sync, encrypted private seed packets at rest, team workspaces, managed MCP endpoints.
- Claude Desktop DXT packaging for the local MCP server.
- Remote MCP connector for hosted/team product variants.
- Browser UI.
- Homebrew distribution.
- SQLite FTS or another richer derived index after file-scan V1 proves insufficient.
- Semantic/vector search.
- Chat export importers.
- Provider-specific onboarding wizards.
- Pass/decision/question/conflict/stale record types if a packet-transfer use case emerges that requires them as distinct record kinds.
- Web landing page and demo video.
- Enterprise audit, SSO, retention, and policy controls.
- 3Notch repo self-hosting a committed `.notch/brief.md` once V1 ships.

## Open Questions

None block V1 implementation. Client-specific MCP config paths may change over time, so `notch onboard --mcp` must be implemented defensively: mutate only known config files after explicit confirmation and otherwise print copy-pasteable instructions.
