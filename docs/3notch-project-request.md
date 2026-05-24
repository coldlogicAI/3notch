# Project Request: 3Notch

## Working Title

3Notch

## One-Line Summary

A local-first CLI and MCP server for moving project context across boundaries that built-in AI tooling cannot cross: across repos, across AI work surfaces, and into new projects.

## Short Description

3Notch packages selected, source-linked context from one repo or AI session into inspectable Markdown packets, then makes them importable into another repo or tool. The user owns the artifacts. The MCP server lets Claude Desktop, Claude Code, Codex, Cursor, ChatGPT, and other clients participate without copy-paste, without hidden chat scraping, and without vendor lock-in.

## Tagline

**Your AI tools will change. Your project context shouldn't have to.**

## Core Problem

Power users work across multiple AI tools (Claude Desktop, Claude Code, Codex, Cursor, ChatGPT) and multiple repos (planning repo, implementation repo, marketing assets, prior client work). Each tool has its own memory layer that dies with the tool. Each repo has its own CLAUDE.md/AGENTS.md/rules conventions. Context that should travel — what shipped, current constraints, prior reasoning, user workflow preferences — gets rebuilt by copy-paste every time work crosses a boundary.

Specific pain examples:

- Writing marketing copy in Claude Desktop that depends on what actually shipped in the repo Claude Code can see.
- Planning a feature in a planning repo and implementing it in a code repo, with the same agent forced to re-explain the design basis.
- Starting a new project with months of prior workflow preferences trapped in the old repo's notes and chat history.
- Switching from Claude to Codex to Cursor as the best tool of the month changes, with all prior context stuck in the previous tool.

## Why This Is Underserved

Incumbents have structural anti-incentive to solve cross-tool portability. Anthropic will not ship "easily move your context to Codex." OpenAI will not ship "easily move to Claude." Cursor will not ship "easily move to Windsurf." Every vendor benefits from making it hard to leave their tool. A neutral, locally-owned packet format is the only place this problem can be solved cleanly.

Existing adjacent tools (Dory, memd, mem0, Letta, Hindsight, claude-mem, various MCP memory servers) compete in the "memory" category. They optimize for in-tool recall, semantic retrieval, or auto-capture within a single workspace. They do not optimize for explicit cross-boundary transfer the user can inspect and review.

## Product Thesis

3Notch is not memory. It is a portable artifact format and a transport layer.

- Memory tools try to make a tool remember more. 3Notch makes context move between tools.
- Vector stores try to retrieve relevant context. 3Notch packages the right context explicitly.
- Auto-capture tools try to remove user discipline. 3Notch makes the user (or agent) name what should move and lets them review it.

The artifact is a Markdown file with YAML frontmatter. It can be copied, attached to a message, committed to a docs repo, or directly imported into another `.notch/` store. It outlives any tool you used to create it.

## Product Direction

3Notch V1 ships exactly three loops:

1. **Packet transfer.** Create a portable context packet from one repo, import it into another repo. CLI: `notch packet create` / `notch packet import`. MCP: `create_packet` / `import_packet` / `list_packets` / `get_packet`.
2. **Private context seeding.** Carry user preferences and workflow conventions from a prior repo into a new repo's ignored `.notch/private/` namespace. CLI: `notch seed from <repo-or-store-path>`. MCP: `create_seed_packet` / `import_seed_packet`.
3. **Targeted briefs.** Produce a scoped task-context document an agent can read before work. CLI: `notch brief` / `notch brief create` / `notch brief list` / `notch brief show`. MCP: `get_brief` / `create_brief` / `list_briefs` / `get_targeted_brief`.

Supporting commands: `notch onboard`, `notch status`, `notch doctor`, `notch mcp serve`. Supporting MCP tools: `get_status`, `run_doctor`.

## What V1 Does Not Do

3Notch V1 deliberately does not ship same-repo same-session continuity tooling. That problem is already solved well enough:

- **CLAUDE.md / AGENTS.md** — persistent project context loaded on session start.
- **Native tool memory** — Claude Code `/memory`, `/compact`, session resume.
- **Git commits** — what changed and why, free.
- **Ad-hoc markdown** — `notes.md`, `TODO.md`, in-repo decision logs.

Specifically deferred: `notch pass`, `notch send`, decision/question/conflict/stale records and commands, and their MCP equivalents. A regression-guard test prevents accidental re-introduction. These may be reconsidered if a cross-boundary use case proves they earn their keep.

Also out of scope: hosted SaaS, login/billing/teams, browser extensions, web dashboards, cloud sync, telemetry, vector databases, semantic search dependencies, hidden chat/project scraping, automatic historical reconstruction, agent orchestration, arbitrary shell execution through MCP, plugin marketplaces, enterprise policy controls, background daemons beyond `notch mcp serve`.

## Consent Model

The cross-tool handoff is explicit and reviewable. 3Notch never reads raw chat logs, Claude Project databases, or other client internals. The flow is:

1. A user asks an agent in Claude Desktop, Claude Code, Codex, or another MCP-capable client to create a 3Notch packet from selected project/session context.
2. The agent calls a local 3Notch MCP tool and supplies selected or summarized context.
3. 3Notch validates and writes a local packet under `.notch/outbox/` or `.notch/private/outbox/`.
4. The user can inspect the packet before moving it.
5. Another repo or tool imports the packet and reads it through CLI or MCP.

Private seed packets are hidden from MCP unless the server is started with `--include-private` for that process.

## Architecture Posture

- TypeScript CLI package distributed as `@3notch/cli` via npm.
- Local-first by default. No native dependencies (no SQLite, no node-gyp). `npx @3notch/cli onboard` must work on Windows, macOS, and Linux without compilation.
- Markdown + YAML frontmatter source records under `.notch/`. JSON config. Derived JSON index files (rebuildable).
- Schema validation via Ajv + JSON Schema.
- MCP server via `@modelcontextprotocol/sdk` over stdio.
- Append-only audit log at `.notch/logs/audit.jsonl`.
- Secret scanning before writes.
- Strict path safety: source-link inputs must resolve under `config.project.root`; symlinks under `.notch/` are rejected; origin metadata in imported packets is preserved unchanged.

## Local Store Layout

```text
.notch/
  .gitignore          # ignores index/, logs/, private/
  config.json         # project-level config
  brief.md            # default project brief; cold-start primer
  briefs/             # targeted briefs
  inbox/              # imported packets
  outbox/             # created packets
  private/
    inbox/            # imported private seed packets
    outbox/           # created private seed packets
  index/              # derived (rebuildable)
  logs/               # audit log
```

## Killer Demo

> *I write marketing copy in Claude Desktop. The copy depends on what actually shipped in the repo. Claude Code knows the repo. Without 3Notch I copy-paste between them and the marketing drifts out of date. With 3Notch: Claude Code creates a packet from current repo state, Claude Desktop imports it, marketing stays grounded in reality.*

Same loop generalizes to any cross-boundary handoff: planning repo → implementation repo, contractor → in-house team, Claude Desktop → Codex CLI, prior project → new project.

## Target User Archetype

Solo operators and small teams running multiple businesses or client engagements across multiple AI tools and repos. Specifically:

- Indie founders using one tool for planning and another for implementation.
- Consultants moving working context between client projects.
- Power users who switch primary AI tools as the best one shifts month-over-month.
- Small agencies where engineering and marketing/copy work happen in different tools but depend on the same project state.

Not the initial target: large engineering teams with a single committed tool stack and centralized DevOps. Those have other tools and other problems.

## Distribution

- Open-source core: this repo, MIT licensed, `@3notch/cli` on npm, `npx @3notch/cli onboard` as the install path.
- Claude Desktop DXT packaging: likely follow-on for easier local install once the MCP server is stable.
- Hosted layer (post-V1): encrypted sync, team workspaces, managed MCP endpoint, browser UI, admin/audit. Standard OSS-core + commercial-layer model used by Tailscale, Sentry, Plausible, Supabase. V1 ships the OSS core in a way that does not paint into the commercial corner later.

## Success Signals For V1

V1 is successful when:

1. A solo operator can run `npx @3notch/cli onboard` in a fresh repo, seed it from a prior project's `.notch/`, and have user preferences carry over without committing them.
2. An agent in Claude Code can create a packet describing current repo state, and an agent in Claude Desktop can import and read it without copy-paste.
3. A planning-repo packet can be created in repo A, imported into implementation-repo B, and read by an agent in B before work starts.
4. All of the above work locally with no cloud dependency, no telemetry, and no chat-history scraping.
5. The OSS repo passes lint, type-check, build, tests, and e2e tests in CI across Ubuntu, macOS, and Windows on Node 20 and 22.
6. README quickstart runs end-to-end from a fresh clone.

## Reference Documents

- [`archived-plans/v1/3notch-v1-technical-spec.md`](archived-plans/v1/3notch-v1-technical-spec.md) — authoritative architecture and contract (V1 shipped).
- [`active-plans/v1.1/3notch-v1.1-plan.md`](active-plans/v1.1/3notch-v1.1-plan.md) — current active plan.
- [`3notch-branding-review.md`](3notch-branding-review.md) — naming, positioning, visual direction, public copy.
