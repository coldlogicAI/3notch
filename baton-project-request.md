# Project Request: Baton

## Working Title

Baton

Alternate names:

- baton
- Pass
- Agent Brief
- Context Pass
- Agent Context Hub
- Agent Memory Exchange
- ContextBridge
- Local Agent Memory
- Context Mesh

## One-Line Summary

A local-first tool that lets Claude, Codex, Cursor, ChatGPT, Gemini, and local agents pass project context to each other without copy-paste or full chat-history sharing.

## Short Description

Build an open-source context-passing system for multi-agent workflows. The system should give different AI tools access to shared project briefs, recent passes, active decisions, open questions, stale assumptions, and source links through a local-first store, CLI, and Model Context Protocol (MCP) server.

The system should not try to make agents directly chat with each other. Instead, agents should publish and query structured context packets owned by the user. Each context packet should be timestamped, source-linked, scoped, searchable, and reviewable.

The first release should be a small, useful developer tool: install it, run onboarding, connect the MCP server, and use it to move work from Claude to Codex without copy-paste. A commercial hosted product can later add encrypted sync, team workspaces, integrations, admin controls, managed MCP endpoints, and collaboration features.

The v1 product should support two related but distinct continuation artifacts:

- **Pass:** lightweight end-of-session continuity: what just happened, what changed, and what the next agent should know.
- **Brief:** targeted task context: a deliberately scoped handoff document for a specific agent, task, timeframe, feature, or problem.

## Core Problem

People doing serious AI-assisted work increasingly use multiple agents and interfaces:

- Claude Projects;
- Claude Code;
- Codex;
- ChatGPT;
- Cursor;
- Windsurf;
- Gemini;
- local coding agents;
- browser-based assistants;
- project-specific scripts and automations.

Each tool accumulates context in its own silo. Important decisions, discoveries, assumptions, and task handoffs become trapped in separate chats, project memories, local markdown files, or conversation histories.

The result is repeated context rebuilding:

- copy-pasting summaries between tools;
- re-explaining project constraints;
- losing important decisions after context compaction;
- agents contradicting prior work;
- stale assumptions persisting without visibility;
- handoff notes living in inconsistent formats;
- no single project memory that multiple agents can safely use.

This is not only annoying. It reduces the quality of AI-assisted work. Agents that lack project continuity repeat mistakes, miss prior decisions, and waste human attention.

## Product Thesis

The solution is not one universal chatbot and not raw chat-history sharing. The solution is a neutral context layer that every agent can read from and write to.

The user should own the shared memory. Agents should interact with it through explicit tools:

- read project context;
- search decisions;
- record a decision;
- pass the baton;
- mark an assumption stale;
- list open questions;
- resolve conflicting notes;
- link context back to source files or external references.

The system should make agent continuity portable across tools.

## Steinberger-Style Product Constraint

The v1 should behave like a small tool that is immediately useful, not a framework that asks users to understand the whole architecture first.

Design constraints:

- one obvious job: hand off work between agents;
- one memorable demo: Claude plans, Codex implements, Claude reviews;
- one fast install path: `npx baton onboard`;
- one first command after setup: `baton brief`;
- one targeted context command: `baton brief create`;
- one end-of-session ritual: `baton pass`;
- CLI and MCP should expose the same core capabilities;
- local-first by default;
- no semantic search or hosted sync required for v1;
- security/privacy boundaries visible in the README;
- `doctor` and `status` should make the tool feel reliable.

The internal architecture can support broader context exchange, but the public product should initially feel like:

> Pass the baton between AI agents.

## Public Positioning

See also: [baton-branding-review.md](baton-branding-review.md) for naming, product design, launch messaging, README hero copy, CLI voice, and visual direction.

Suggested tagline:

> Stop copy-pasting context between AI tools.

Sharper launch tagline:

> When Claude stops, Codex starts with the right context.

Suggested positioning statement:

> Baton is a local-first tool for passing project context between AI agents. It gives Claude, Codex, Cursor, ChatGPT, and local agents the same source-linked project decisions, recent passes, open questions, stale assumptions, and conflict records without exposing full private chat histories.

Alternative positioning:

> Git for agent context.

Or:

> A vendor-neutral context exchange for AI agents.

Launch positioning should prefer "pass" and "brief" over "memory." Memory is the implementation detail; continuation is the user value.

Use "brief" carefully:

- `baton brief`: the default compact project brief every agent reads before work.
- `baton brief create`: a targeted, scoped brief for a specific agent/task, usually created intentionally from deeper project context.

Avoid positioning the project as merely:

> Persistent memory for agents.

That category is already crowded. The sharper wedge is:

> Structured project continuity across agents.

## Why Now

The agent ecosystem is fragmenting quickly. Users are no longer doing all AI work in one interface. They may use Claude for planning, Codex for implementation, ChatGPT for research, Cursor for inline coding, and local agents for automation.

At the same time, MCP has become a practical bridge between AI clients and external tools or data sources. A context exchange layer can expose the same project memory to multiple AI systems using one protocol.

This creates a timely opportunity for a useful open-source project:

- developers already understand the pain;
- MCP gives the integration path;
- local-first tools are easier to trust;
- the project can be demonstrated quickly;
- commercial value can be built around sync, teams, hosted connectors, and enterprise controls.

## Market Reality And Differentiation

The generic "MCP memory server" category is already active. Existing and emerging projects include local-first memory daemons, semantic memory stores, knowledge graph memory backends, MCP memory servers, and hosted/self-hosted long-term memory products. Examples include Dory, memd, Truenex Memory, MentisDB, Engram, and other open-source MCP memory projects.

This is useful validation: the pain is real, the integration surface is timely, and developers are already looking for a solution. It also means Baton should not compete as another undifferentiated memory database.

The differentiator should be workflow semantics:

- not just memory, but continuity;
- not just recall, but project continuity;
- not just semantic search, but decisions and assumptions;
- not just notes, but stale-context and conflict management;
- not just storage, but source-linked context packets;
- not just Claude memory, but vendor-neutral agent exchange;
- not just developer memory, but inspectable human-owned project state.

### Competitive Position

Most adjacent tools appear to emphasize one or more of:

- persistent memory;
- semantic recall;
- vector search;
- knowledge graphs;
- local-first storage;
- coding-agent project context;
- MCP access.

Baton should emphasize a narrower and more operational promise:

> When one agent finishes, the next agent can pick up the work correctly.

This means the product should prioritize:

- explicit pass records;
- active project context;
- decision logs;
- unresolved questions;
- assumptions with freshness status;
- conflict records;
- source-linked context;
- agent write attribution;
- human-readable files;
- agent prompts and workflow examples.

Semantic memory can be added later, but it should not define the first version.

### Primary Differentiators

#### 1. Baton-First

Every agent session should end by passing the baton. The pass should capture what changed, what was learned, what remains open, which files or sources matter, and what the next agent should know.

Most memory systems optimize retrieval. This project should optimize continuation.

#### 2. Decision-Centric

The system should make decisions first-class. A decision is not just a note. It has a title, rationale, author, timestamp, status, source links, affected scope, and supersession history.

Agents should be instructed to treat active decisions as constraints unless the user overrides them.

#### 3. Stale Context Management

Long-term memory becomes dangerous when it silently ages. The system should surface stale assumptions and old decisions instead of blindly injecting them.

This is a stronger value proposition than "remembers everything."

#### 4. Conflict Detection

When different agents record conflicting assumptions or decisions, the system should flag the conflict for human resolution. Even simple conflict records are valuable because they make disagreement visible.

#### 5. Source-Linked Packets

Important context should link to local files, URLs, commits, issues, documents, or prior packets. This makes the context inspectable and helps future agents verify it.

#### 6. Human-Owned, Human-Readable Memory

The memory store should be readable and editable without the tool. Markdown/YAML packets and a regenerable SQLite index are a strategic choice, not just an implementation detail.

#### 7. Workflow Prompts Included

The project should ship not only tools but usage patterns:

- Claude planning prompt;
- Codex implementation prompt;
- research-agent prompt;
- review-agent prompt;
- end-of-session pass prompt.

This can be a major adoption advantage because users need the workflow, not just the server.

### Anti-Differentiators To Avoid

Do not lead with:

- vector database;
- "remembers everything";
- personality memory;
- autonomous self-model;
- generic knowledge graph;
- chat history ingestion;
- all-in-one agent platform.

These are either crowded, risky, or too abstract for the first wedge.

## Goals

### Primary Goals

1. Make it trivial for one agent to hand work to another.
2. Provide a compact `brief` that every agent can read before starting.
3. Support targeted `brief create` workflows for specific tasks, timeframes, features, packages, or future agents.
4. Provide a structured `pass` flow that every agent can use before stopping.
5. Create a local-first shared context store for AI-assisted project work.
6. Expose the same core capabilities through CLI and MCP.
7. Define clean, portable file formats for project context.
8. Treat decisions, assumptions, open questions, briefs, passes, and conflicts as first-class records.
9. Preserve source links, timestamps, authorship, and scope.
10. Detect stale or conflicting context before it pollutes future work.
11. Make it easy to bootstrap context from existing notes, repos, or pass files.
12. Keep the open-source core useful on its own.
13. Leave room for a hosted commercial layer without crippling the OSS version.

### Non-Goals

1. Do not scrape private chat histories as the primary mechanism.
2. Do not require every agent to use the same model provider.
3. Do not store secrets or credentials in ordinary project context.
4. Do not make agents automatically trust unreviewed notes.
5. Do not build a general vector database first.
6. Do not require a cloud account for the open-source core.
7. Do not pretend this replaces source control, documentation, or human judgment.
8. Do not market the first release as generic "agent memory" without a specific pass workflow.
9. Do not optimize for storing everything; optimize for preserving the right continuation context.
10. Do not build a dashboard before the CLI/MCP loop is excellent.
11. Do not add broad integrations before Claude-to-Codex pass works cleanly.
12. Do not make v1 auto-reconstruct months of history. V1 should store, retrieve, and expose targeted briefs; agents can compose the brief content from available context.
13. Do not turn targeted briefs into a complex research workflow in v1.

## Core Design Principle

Agents should not directly share private thought or full conversation history.

They should share structured, user-owned context artifacts:

- decisions;
- targeted briefs;
- passes;
- assumptions;
- open questions;
- active task state;
- source links;
- project rules;
- summaries;
- stale notes;
- conflict records.

This keeps the system inspectable and reduces privacy risk.

## Target Users

### Initial Users

- developers using multiple coding agents;
- founders building with several AI tools;
- consultants moving context between projects;
- researchers who use multiple LLMs;
- technical writers and product leads who maintain project memory;
- power users of Claude Projects, Codex, Cursor, ChatGPT, and local agents.

### Later Users

- engineering teams;
- AI-first agencies;
- product teams;
- legal or research teams working with AI tools;
- enterprises that need shared agent context with audit controls;
- regulated teams that need local-first memory and permission boundaries.

## Key Use Cases

### Use Case 0: End Every Agent Session By Passing The Baton

This is the core product loop.

Workflow:

1. An agent completes planning, research, implementation, review, or debugging work.
2. Before ending, the agent writes a structured pass.
3. The pass captures the outcome, decisions, changed files or sources, unresolved questions, stale assumptions discovered, and recommended next action.
4. The next agent reads recent passes before beginning.

This should be the default behavior promoted in docs, examples, and prompts.

### Use Case 0.5: Create A Targeted Brief For A Specific Agent

This is the deliberate deep-context workflow.

A user has months of project history, but the next agent should not receive everything. The user asks Claude to prepare a focused brief for Codex, another model, or a future session.

Examples:

- "Create a Codex brief for enhancing the March training feature."
- "Create a brief explaining the design basis for the auth flow."
- "Create a package of the skill files and conventions Codex needs."
- "Create a debugging brief for the routing bug without unrelated project context."

Workflow:

1. User asks Claude to create a targeted brief.
2. Claude uses relevant current context, project memory, and user-specified scope.
3. Claude writes the brief into Baton with title, goal, target agent, scope, relevant files, key decisions, design basis, pitfalls, open questions, and recommended next steps.
4. Codex or another agent retrieves that targeted brief before acting.

V1 does not need to automatically discover the full historical context. The agent creating the brief is responsible for supplying the content. Baton is responsible for storing, indexing, retrieving, and exposing the brief cleanly.

### Use Case 1: Claude To Codex

A user plans a feature in Claude, then wants Codex to implement it.

Workflow:

1. Claude writes a structured pass into Baton.
2. The pass includes decisions, constraints, files discussed, and open questions.
3. Codex queries the project context through MCP.
4. Codex implements the work without requiring the user to paste the whole Claude conversation.
5. Codex writes an implementation summary back into the same project memory.

### Use Case 2: Multi-Session Project Continuity

A user returns to a project after several days.

Workflow:

1. The agent asks for current project context.
2. Baton returns the project overview, recent decisions, active tasks, and unresolved questions.
3. The agent can continue without the user reconstructing the history.

### Use Case 3: Conflict Detection

Two agents record conflicting decisions.

Example:

- Claude records: "Use SQLite for local store."
- Codex records: "Use Postgres for local store."

The system flags a conflict and asks for resolution rather than silently letting the newer note override the older one.

### Use Case 4: Stale Assumption Tracking

An agent records an assumption:

> "The app currently has no authentication layer."

Later, another agent adds authentication.

The old assumption can be marked stale, and future agents can avoid relying on it.

### Use Case 5: Shared Project Rules

A project has conventions:

- use TypeScript;
- do not add new dependencies without approval;
- use existing design components;
- write tests for shared behavior;
- keep outputs under a specific directory.

Those rules live in one shared context file and can be accessed by any agent.

### Use Case 6: Human-Readable Pass Log

The user wants to review what agents have been doing.

The system maintains readable passes:

- what changed;
- why it changed;
- what remains open;
- what files matter;
- what assumptions were made.

## Conceptual Architecture

```text
+------------------------------------------------------+
|                       Baton                  |
|------------------------------------------------------|
| Local Context Store                                  |
| Project Registry                                     |
| Context Packet Index                                 |
| Search Layer                                         |
| Staleness And Conflict Engine                        |
| MCP Server                                           |
| CLI                                                  |
| Importers / Exporters                                |
| Optional Hosted Sync                                 |
+----------------------------+-------------------------+
                             |
                             |
        +--------------------+--------------------+
        |                    |                    |
        v                    v                    v
   Claude / Claude Code    Codex / ChatGPT      Cursor / Local Agents
```

## Product Surface For V1

V1 should expose a small command set with strong names.

Primary commands:

```text
baton onboard
baton brief
baton brief create
baton brief list
baton brief show <id>
baton pass
baton status
baton doctor
baton mcp serve
```

Secondary commands:

```text
baton decision add
baton question add
baton question list
baton assumption add
baton stale mark
baton conflict list
baton search
```

The first five commands should be enough for a user to understand the product:

- `onboard`: set up the local store and optionally install MCP configs.
- `brief`: show the compact context every agent should read first.
- `brief create`: create a targeted task brief for a specific agent, scope, feature, timeframe, or problem.
- `brief list`: list saved targeted briefs.
- `pass`: record what the last agent did and what the next agent needs.
- `status`: summarize recent passes, open questions, stale assumptions, and conflicts.
- `doctor`: check configuration, permissions, MCP setup, broken links, stale context, and conflicts.

## Onboarding Flow

The onboarding command should guide setup rather than assume users know where files go.

```bash
npx baton onboard
```

The flow should:

1. Detect the current Git repository.
2. Ask whether to create `.baton/` in the repo.
3. Create starter files.
4. Detect known agent config locations where possible.
5. Offer to add an MCP server entry for Claude/Codex/Cursor-compatible clients.
6. Create a starter project brief.
7. Print the exact prompt to give an agent.

Example final output:

```text
Baton is ready.

Project: my-app
Store: .baton/
MCP: configured for Claude Desktop

Try:
  baton brief
  baton pass
  baton mcp serve

Agent prompt:
  Before starting, call get_brief. Before stopping, call write_pass.
```

## Doctor And Status

`doctor` should make the project feel dependable.

Checks:

- context store exists;
- project config is valid;
- MCP server command works;
- packet files parse;
- index is current;
- source links resolve where possible;
- no obvious secret leaks;
- no unresolved high-priority conflicts;
- stale context is reported;
- known agent config entries are present.

`status` should be the quick human-readable snapshot:

```text
Project: my-app
recent passes: 3
Open questions: 2
Active decisions: 8
Stale assumptions: 1
Conflicts: 0
Last pass: codex, 18 minutes ago
```

## File-Based MVP Structure

The first implementation should work as a plain local folder:

```text
.baton/
  config.yaml
  project.md
  brief.md
  briefs/
    2026-05-23-march-training-feature-for-codex.md
    2026-05-23-skill-files-package.md
  decisions.md
  open-questions.md
  assumptions.md
  stale.md
  conflicts.md
  sources.md
  passes/
    2026-05-23-claude-planning.md
    2026-05-23-codex-implementation.md
  packets/
    ctx_000001.yaml
    ctx_000002.yaml
  index.sqlite
```

The folder should be human-readable and Git-friendly. The SQLite index can be regenerated from source files.

## Context Packet Model

A context packet is the atomic unit of shared agent memory.

Example:

```yaml
id: ctx_20260523_0001
project: derive
type: decision
title: Use MCP as first integration interface
status: active
created_at: 2026-05-23T14:30:00-04:00
created_by:
  actor_type: agent
  agent_name: codex
  model_provider: openai
scope:
  visibility: local
  applies_to:
    - project
tags:
  - mcp
  - architecture
  - integration
source_links:
  - kind: file
    path: docs/architecture.md
  - kind: url
    url: https://modelcontextprotocol.io/
content: |
  The initial integration interface should be an MCP server because it can be used by multiple AI clients without creating tool-specific integrations first.
confidence: medium
review:
  human_reviewed: false
  reviewer: null
  reviewed_at: null
supersedes: null
related:
  - ctx_20260523_0000
```

## Context Packet Types

Initial packet types:

- project_overview;
- active_context;
- brief;
- decision;
- assumption;
- open_question;
- pass;
- task;
- source_link;
- stale_note;
- conflict;
- warning;
- user_preference;
- agent_discovery;
- implementation_summary;
- research_summary.

Later packet types:

- requirement;
- architecture_note;
- design_rationale;
- test_result;
- bug_context;
- release_note;
- meeting_note;
- external_reference;
- policy_note;
- private_note.

## Status Model

Packets should have explicit status:

- draft;
- active;
- stale;
- superseded;
- disputed;
- resolved;
- archived;
- private;

The system should default to active for ordinary user-created notes, but agent-created notes may optionally require review depending on project settings.

## Source Linking

Every important packet should support links to:

- local files;
- repo paths;
- URLs;
- issue IDs;
- commit hashes;
- chat export files;
- external documents;
- previous packets;
- command outputs;
- user notes.

The goal is not formal legal provenance. The goal is practical traceability so future agents can understand where context came from.

## MCP Tools

The MCP server should expose simple, high-value tools first.

### Read Tools

```text
get_brief
get_targeted_brief
list_briefs
list_projects
get_project_context
search_context
get_recent_passes
get_decisions
get_open_questions
get_assumptions
get_stale_context
get_conflicts
get_source_index
```

### Write Tools

```text
create_brief
write_pass
record_decision
record_assumption
add_open_question
answer_open_question
mark_context_stale
resolve_conflict
add_source_link
update_active_context
```

### Maintenance Tools

```text
doctor
get_status
validate_context_store
rebuild_index
summarize_project
detect_conflicts
detect_stale_context
export_project_context
import_context_packet
```

## CLI Commands

The CLI should mirror the MCP tools, but the first-class command path should stay short.

```text
baton onboard
baton brief
baton brief create
baton brief list
baton pass
baton status
baton doctor
baton mcp serve
baton search <query>
baton decision add
baton question add
baton question list
baton assumption add
baton stale mark <packet-id>
baton conflict list
baton conflict resolve <conflict-id>
baton index rebuild
baton export
baton import <file>
```

Potential aliases:

```text
ctx brief
ctx brief create
ctx brief show <id>
ctx pass
ctx status
ctx mcp serve
```

## Project Configuration

Example:

```yaml
project:
  name: derive
  root: /Users/example/work/derive
  default_visibility: local

storage:
  format: markdown_yaml
  index: sqlite
  embeddings: optional

review_policy:
  agent_notes_require_review: false
  decisions_require_human_review: true
  stale_after_days: 30

privacy:
  allow_remote_sync: false
  redact_patterns:
    - API_KEY
    - SECRET
    - PASSWORD

agents:
  allowed_writers:
    - claude
    - codex
    - cursor
    - chatgpt
```

## Targeted Briefs

Targeted briefs are first-class v1 artifacts, but they should remain constrained.

A targeted brief is a scoped handoff document for a specific future task or agent. It is not the same as the default project brief and it is not a full project memory dump.

Examples:

```bash
baton brief create --title "March training feature" --to codex
baton brief create --title "Skill files package" --to claude
baton brief list
baton brief show march-training-feature
```

MCP equivalent:

```text
create_brief({
  title: "March training feature",
  target_agent: "codex",
  goal: "Enhance and debug the March training feature",
  scope: {
    timeframe: "March 2026",
    topics: ["training module", "skill files", "design rationale"],
    files: ["skills/", "src/training/", "docs/march-notes.md"]
  },
  content: "..."
})
```

Recommended brief structure:

```md
# Baton Brief: March Training Feature

## Goal For Codex

## Relevant Background

## Design Basis

## Important Decisions

## Relevant Files And Sources

## Known Pitfalls

## Open Questions

## Recommended Next Steps
```

V1 scope:

- create targeted briefs;
- list targeted briefs;
- retrieve targeted briefs by ID/title;
- expose targeted briefs through MCP;
- export a targeted brief as markdown.

Deferred:

- automatic month-by-month reconstruction;
- semantic search over all project history;
- chat export ingestion;
- automatic source selection;
- UI-based brief assembly;
- review workflows for briefs.

## Search Strategy

The MVP should start with practical local search:

1. keyword search;
2. tag search;
3. packet type filters;
4. date filters;
5. project filters;
6. source path filters.

Vector search can be optional later. The first version should not depend on embeddings or a hosted model.

Potential search modes:

- exact text;
- fuzzy text;
- semantic search if embeddings are configured;
- recent context;
- decisions only;
- unresolved only;
- stale candidates.

## Staleness Detection

Stale context is one of the main differentiators.

The system should support:

- manual stale marking;
- expiry rules;
- source file change detection;
- supersession links;
- conflict detection;
- "last verified" timestamps;
- stale warnings in context retrieval.

Example:

```text
Warning: 3 relevant assumptions are older than 30 days.
Warning: 1 decision references a file that has changed since the note was created.
Warning: 2 active packets conflict on the selected database.
```

## Conflict Detection

Conflict detection can start simple.

MVP approaches:

- detect multiple active decisions with overlapping tags and contradictory keywords;
- detect packets explicitly marked as conflicting;
- allow agents to submit conflict candidates;
- require human resolution for disputed context.

Later approaches:

- LLM-assisted contradiction detection;
- source-aware conflict reports;
- confidence scoring;
- project-specific conflict rules.

## Human Review

The system should not assume all agent-written context is correct.

Review features:

- mark reviewed;
- approve decision;
- reject packet;
- edit packet;
- supersede packet;
- mark as stale;
- merge duplicates;
- resolve conflict;
- lock packet.

This can be CLI-first in the MVP.

## Import Paths

Initial importers:

- markdown files;
- AGENTS.md;
- CLAUDE.md;
- README.md;
- local project notes;
- chat export markdown;
- clipboard paste through CLI;
- JSON/YAML packets.

Later importers:

- Claude Project export if available;
- ChatGPT export;
- GitHub issues;
- Linear/Jira;
- Slack;
- Notion;
- Google Docs;
- Obsidian vaults.

## Export Paths

Exports:

- markdown bundle;
- JSONL packet stream;
- single project brief;
- targeted brief;
- agent pass;
- MCP resource list;
- repo bootstrap files such as AGENTS.md or CLAUDE.md.

Important: export should be explicit. The tool should avoid silently pushing private memory to external services.

## Open-Source Scope

The open-source core should include:

- local context store;
- packet schema;
- CLI;
- MCP server;
- file import/export;
- local search;
- SQLite index;
- pass templates;
- targeted brief templates;
- decision records;
- open question records;
- assumption records;
- staleness marking;
- conflict records;
- source link validation;
- workflow prompts;
- basic docs;
- example integrations;
- tests.

## Commercial Scope

The commercial product can be built around:

- hosted encrypted sync;
- cross-device context;
- team workspaces;
- managed MCP endpoint;
- browser UI;
- connector setup wizards;
- Claude/Codex/Cursor/Gemini onboarding flows;
- SSO;
- audit logs;
- permission controls;
- cloud backups;
- shared team memory;
- admin dashboards;
- private connector marketplace;
- hosted semantic search;
- pass dashboards;
- context health reports;
- compliance exports;
- enterprise deployment support.

This preserves the value of the open-source core while creating a clear reason to pay.

## Trust And Privacy Requirements

Because this tool may store sensitive project memory, trust is central.

Requirements:

- local-first by default;
- no telemetry by default;
- explicit opt-in for cloud sync;
- readable storage format;
- export and delete controls;
- redaction patterns;
- secret detection;
- permission scopes;
- audit log for write operations;
- clear separation between local memory and hosted sync.

The README should be very explicit:

> Your agent memory stays local unless you choose to sync it.

## Security Considerations

MCP tools can be powerful. The server should be conservative.

Security requirements:

- write tools should be scoped to the configured context store;
- no arbitrary shell execution in the MCP server;
- no broad filesystem read access by default;
- path traversal protection;
- optional read-only mode;
- optional approval mode for writes;
- secret scanning before storing packets;
- clear audit log of agent writes.

## Technical Stack Recommendation

Good default:

- TypeScript for the CLI and MCP server;
- SQLite for local index;
- markdown plus YAML frontmatter for human-readable packets;
- JSON Schema for validation;
- optional embeddings later;
- npm distribution first;
- Homebrew later if the tool gets traction.

TypeScript advantages:

- strong fit for MCP ecosystem;
- easy npm install;
- good developer tooling.

Python advantages:

- easy scripting;
- strong local data tooling;
- easy packaging for CLI users.

Pragmatic recommendation:

- TypeScript for first public release.
- Use `npx baton onboard` as the primary install-free path.
- Keep the file formats language-neutral.

## MVP Deliverables

### MVP 1: Local Core

- `baton onboard`
- `baton brief`
- `baton brief create`
- `baton brief list`
- `baton status`
- `baton doctor`
- project config file
- packet schema
- create/read/update packets
- markdown/YAML storage
- SQLite index
- keyword search
- pass writer as the flagship command
- targeted brief writer
- decision recorder
- open question tracker
- assumption recorder
- stale marker
- basic conflict records
- source link field support
- context health summary

### MVP 2: MCP Server

- `baton mcp serve`
- `get_brief`
- `create_brief`
- `get_targeted_brief`
- `list_briefs`
- `write_pass`
- read tools
- write tools
- project context retrieval
- targeted brief retrieval
- pass publishing
- decision recording
- open question listing
- stale context retrieval
- conflict listing
- context health retrieval

### MVP 3: Agent Examples

- Claude Desktop or Claude connector setup guide;
- Claude Code setup guide;
- Codex usage guide;
- Cursor usage guide if possible;
- demo repo with multiple agents writing context.
- end-of-session pass prompt pack;
- Claude planning to Codex implementation workflow;
- research agent to implementation agent workflow.
- README quickstart that completes the pass loop in under five minutes.

### MVP 4: Public Launch Assets

- README;
- demo GIF or short video;
- example project memory folder;
- quickstart;
- comparison with copy-paste workflow;
- security/privacy page;
- hosted sync waitlist page.
- one-command demo script if feasible.

## Suggested Roadmap

### Phase 0: Product Definition

- finalize name, preferably short enough for CLI use;
- choose license;
- define packet schema;
- choose TypeScript;
- define MCP tool surface;
- define local file layout;
- write README skeleton.

### Phase 1: Local CLI

- implement `onboard`;
- implement `brief`;
- implement `brief create`;
- implement `brief list`;
- implement `pass`;
- implement `status`;
- implement `doctor`;
- create context store;
- create project;
- add packets;
- list/search packets;
- write passes;
- record decisions;
- track open questions;
- mark stale;
- rebuild index.

### Phase 2: MCP Integration

- implement MCP server;
- expose read tools;
- expose write tools;
- add read-only mode;
- add project scoping;
- add write audit log;
- test with at least one Claude surface and one OpenAI/Codex-compatible surface.

### Phase 3: Quality Layer

- conflict detection;
- stale warnings;
- source link validation;
- packet validation;
- secret scanning;
- importers for common project files.

### Phase 4: Hosted Product Prototype

- encrypted sync service;
- account system;
- project sync;
- hosted MCP endpoint;
- browser UI;
- waitlist onboarding;
- billing experiment.

### Phase 5: Team Features

- shared workspaces;
- roles and permissions;
- review workflows;
- audit trails;
- admin controls;
- SSO;
- enterprise deployment.

## Example Agent Prompts

### Prompt For Claude

```text
Use the Baton MCP server before starting. Read the project overview, active context, recent decisions, and open questions. When you finish, pass the baton summarizing what you changed, what decisions you made, what remains open, and which files or sources matter.
```

### Prompt For Claude To Create A Targeted Brief

```text
Create a targeted Baton brief for Codex. Do not include the full project history. Include only the context needed for the requested task: goal, relevant background, design basis, active decisions, relevant files/sources, known pitfalls, open questions, and recommended next steps. Save it with create_brief.
```

### Prompt For Codex

```text
Before editing code, query Baton for active project context and recent passes. Treat active decisions as project constraints unless the user says otherwise. After implementation, pass the baton and mark any stale assumptions you discovered.
```

### Prompt For Research Agent

```text
Search Baton for prior research before browsing. Record new findings as source-linked research_summary packets. Do not overwrite existing decisions. If findings contradict active context, create a conflict record.
```

## README Outline

```text
# Baton

Local-first context passing for AI agents.

## Why
Stop copy-pasting context between Claude, Codex, Cursor, ChatGPT, and local agents.

## What It Does
- passes context between agents
- builds the brief every agent reads first
- creates targeted briefs for specific tasks
- records decisions
- tracks open questions
- marks stale assumptions
- flags conflicts
- runs as CLI and MCP server

## Quickstart
npx baton onboard
baton brief
baton mcp serve

## How Agents Use It
...

## Privacy
Local-first. No cloud sync unless enabled.

## Roadmap
...
```

## Competitive Landscape

Likely adjacent categories:

- MCP memory servers;
- note-taking tools;
- vector databases;
- AI coding agent orchestrators;
- project management tools;
- knowledge bases;
- chat export tools;
- team documentation tools.

Known adjacent projects and signals:

- Dory: local-first memory daemon positioning for AI agents;
- memd: memory and persistence for AI agents;
- Truenex Memory: MCP memory server/product positioning;
- MentisDB: memory-oriented database layer;
- Engram: local memory-oriented agent tooling;
- other MCP servers that expose notes, files, vector stores, or knowledge graphs.

This means the first public release must avoid sounding like "yet another MCP memory server." The README, demo, and API should make the workflow difference obvious in the first minute.

Differentiation:

- pass-the-baton workflow, not passive memory;
- decision-centric records, not generic notes;
- stale-context and conflict visibility, not blind recall;
- source-linked packets, not opaque embeddings;
- human-readable local files with a regenerable index;
- vendor-neutral MCP access;
- prompt packs and demos for real Claude/Codex/Cursor workflows;
- built for multi-agent project continuity, not personality memory or generic notes.

### Differentiation Test

Every major feature should pass at least one of these tests:

1. Does it make a later agent more likely to continue correctly?
2. Does it reduce copy-paste between AI tools?
3. Does it make prior decisions or assumptions easier to inspect?
4. Does it prevent stale or conflicting context from silently spreading?
5. Does it preserve user ownership of project memory?

If a proposed feature only makes the system a more generic memory store, defer it.

## Business Model

Recommended model:

Open-source core plus hosted sync and team features.

Possible paid tiers:

### Free OSS

- local CLI;
- local MCP server;
- local search;
- local project memory;
- import/export.

### Pro

- encrypted personal sync;
- hosted MCP endpoint;
- cross-device memory;
- browser UI;
- managed backups;
- advanced search.

### Team

- shared workspaces;
- permissions;
- team audit log;
- review workflows;
- connector management;
- admin dashboard.

### Enterprise

- SSO;
- private deployment;
- custom retention;
- compliance exports;
- managed onboarding;
- dedicated support;
- security review package.

## Launch Strategy

### Initial Launch

Audience:

- AI power users;
- developers using Claude Code and Codex;
- Cursor users;
- MCP builders;
- indie hackers;
- technical founders.

Launch assets:

- GitHub repo;
- short demo video;
- clear README;
- "Claude to Codex pass" demo;
- blog post explaining why passes beat generic memory;
- hosted sync waitlist.

### Demo Scenario

1. Plan a feature in Claude.
2. Claude writes pass to Baton.
3. Codex reads pass and implements feature.
4. Codex writes implementation summary.
5. Claude reads summary and reviews.
6. No copy-paste between tools.

The demo should use the exact v1 commands:

```bash
npx baton onboard
baton brief
baton brief create --title "March training feature" --to codex
baton pass
baton status
baton mcp serve
```

This demo is easy to understand and highly marketable.

## Success Metrics

OSS metrics:

- GitHub stars;
- installs;
- MCP server usage;
- number of packet writes;
- number of passes written;
- number of targeted briefs created;
- number of targeted briefs retrieved by agents;
- ratio of baton pass packets to generic notes;
- number of decisions recorded;
- number of stale packets marked;
- number of conflicts created/resolved;
- repeat users;
- community connectors;
- issues and PRs.

Product metrics:

- waitlist signups;
- hosted sync activations;
- projects synced;
- team workspace creation;
- conversion to paid;
- retained weekly active users.

Quality metrics:

- context retrieval usefulness;
- duplicate context reduction;
- copy-paste reduction between agents;
- successful agent-to-agent pass rate;
- percentage of sessions ending with a pass;
- stale warning accuracy;
- conflict detection usefulness;
- successful passes between tools.

## Risks

### Risk: Too Abstract

Mitigation:

- lead with a concrete Claude-to-Codex pass demo;
- keep the first README practical;
- avoid over-explaining agent theory.

### Risk: Undifferentiated MCP Memory Server

Mitigation:

- avoid generic memory positioning;
- make passes the first demo and first command path;
- ship decision, assumption, stale, and conflict packet types in MVP;
- make "context health" visible;
- document why the project is not a vector database or chat-history store.

### Risk: MCP Ecosystem Changes

Mitigation:

- keep storage and CLI independent of MCP;
- use MCP as one interface, not the entire product.

### Risk: Users Fear Privacy Exposure

Mitigation:

- local-first by default;
- no telemetry by default;
- readable files;
- explicit cloud opt-in;
- strong privacy page.

### Risk: Existing Tools Add Memory

Mitigation:

- focus on vendor-neutral cross-tool continuity;
- no single vendor can solve all agent silos for all users.

### Risk: Open Source Undercuts Product

Mitigation:

- sell hosted sync, teams, admin, search, and convenience;
- keep core open to build trust and adoption.

### Risk: Memory Becomes Messy

Mitigation:

- packet types;
- staleness;
- conflicts;
- review state;
- summarization;
- cleanup commands.

## Open Questions

1. Should the first implementation be TypeScript or Python?
2. Should packet storage be markdown-first or JSON-first?
3. Should the default store live in the repo or in a global user directory?
4. How should multiple projects share global user preferences?
5. Should decisions require human review by default?
6. How much write access should agents get initially?
7. Should semantic search be included in MVP or deferred?
8. What is the best short product name?
9. Should hosted sync be announced at launch or after OSS traction?
10. How should Claude Projects imports work without brittle scraping?
11. What exact "context health" score or summary should be shown in MVP?
12. Should `pass` be the primary quickstart command after `init`?
13. Should every write tool ask agents to classify packet type explicitly?
14. Which competitor claims should be acknowledged directly in launch materials, if any?
15. Should targeted briefs be stored as standalone markdown files, packet YAML, or both?
16. Should `baton brief` show only the default project brief while targeted briefs require `baton brief show <id>`?

## Acceptance Criteria For First Useful Release

The first useful release is complete when:

1. A user can initialize a context store.
2. A user can create a project.
3. A user can add decisions, passes, assumptions, and open questions.
4. A user can create a targeted brief for a specific task or agent.
5. A user can search project context locally.
6. An MCP-compatible agent can read project context.
7. An MCP-compatible agent can retrieve a targeted brief.
8. An MCP-compatible agent can pass the baton.
9. The system records who or what wrote each packet.
10. The system can mark packets stale.
11. The system can list unresolved questions.
12. The user can inspect all stored memory as plain files.
13. The system can create and list basic conflict records.
14. The system can produce a context health summary covering stale notes, open questions, recent passes, targeted briefs, and conflicts.
15. The README includes a working Claude-to-Codex or equivalent demo.
16. The quickstart demonstrates a complete pass loop and one targeted brief, not just memory storage.

## References

- Anthropic Model Context Protocol documentation: https://docs.anthropic.com/en/docs/mcp
- Claude connectors overview: https://claude.com/docs/connectors/overview
- OpenAI Agents SDK MCP documentation: https://openai.github.io/openai-agents-python/mcp/
- Model Context Protocol specification: https://modelcontextprotocol.io/
- Dory: https://dory.deeflect.com/
- memd: https://memd.dev/
- Truenex Memory: https://memory.truenex.ai/
