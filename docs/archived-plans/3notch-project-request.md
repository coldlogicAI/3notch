# Project Request: 3Notch

## Working Title

3Notch

## One-Line Summary

A local-first CLI and MCP server for moving project context — including the actual files — across boundaries that built-in AI tooling cannot cross: across repos, across AI work surfaces, across tools, and across machines.

## Short Description

3Notch packages selected, source-linked context — markdown summaries, structured intent, and the actual artifact bytes — from one repo or AI session into inspectable packets, then makes them importable into another repo or tool. The user owns the artifacts. The MCP server lets Claude Desktop, Claude Code, Codex, Cursor, ChatGPT, and other clients participate without copy-paste, without hidden chat scraping, and without vendor lock-in.

## Tagline

**Mark your trail.**

Your AI tools will change. Your project context shouldn't have to.

## Core Problem

Power users work across multiple AI tools (Claude Desktop, Claude Code, Codex, Cursor, ChatGPT) and multiple repos (planning repo, implementation repo, marketing assets, prior client work). Each tool has its own memory layer that dies with the tool. Each repo has its own CLAUDE.md/AGENTS.md/rules conventions. Context that should travel — what shipped, current constraints, prior reasoning, the actual files produced, user workflow preferences — gets rebuilt by copy-paste every time work crosses a boundary.

Specific pain examples:

- Writing marketing copy in Claude Desktop that depends on what actually shipped in the repo Claude Code can see.
- Designing a brand asset in one tool (the HTML showcase, the mascot JPEG) and handing it off to another tool to build the website — today the bytes never travel with the summary.
- Planning a feature in a planning repo and implementing it in a code repo, with the same agent forced to re-explain the design basis.
- Starting a new project with months of prior workflow preferences trapped in the old repo's notes and chat history.
- Switching from Claude to Codex to Cursor as the best tool of the month changes, with all prior context stuck in the previous tool.

## Why This Is Underserved

Incumbents have structural anti-incentive to solve cross-tool portability. Anthropic will not ship "easily move your context to Codex." OpenAI will not ship "easily move to Claude." Cursor will not ship "easily move to Windsurf." Every vendor benefits from making it hard to leave their tool. A neutral, locally-owned packet format is the only place this problem can be solved cleanly.

Existing adjacent tools (Dory, memd, mem0, Letta, Hindsight, claude-mem, various MCP memory servers) compete in the "memory" category. They optimize for in-tool recall, semantic retrieval, or auto-capture within a single workspace. They do not optimize for explicit cross-boundary transfer the user can inspect and review, and they do not carry artifact bytes alongside the summary.

## Product Thesis

3Notch is not memory. It is a portable artifact format and a transport layer.

- Memory tools try to make a tool remember more. 3Notch makes context move between tools.
- Vector stores try to retrieve relevant context. 3Notch packages the right context explicitly.
- Auto-capture tools try to remove user discipline. 3Notch makes the user (or agent acting on user direction) name what should move and lets them review it.

A packet is a folder containing a human-readable Markdown record with YAML frontmatter, the artifact files referenced by the record, and a manifest that hash-locks the bundle. It can be copied between local stores, archived for transport across machines, attached to a message, committed to a docs repo, or directly imported into another `.notch/` store. It outlives any tool you used to create it.

What goes away is *the user as bus* — the manual copy-paste transport role. What stays, by design, is the user as the one who decides what gets packaged and reviews it before another tool relies on it. No background scraping, no automatic capture, no agent silently shipping context.

## Product Surface

3Notch is a CLI (`notch`) and an MCP server (`notch mcp serve`) shipping these primitives:

**Packet transfer with artifacts.** Create a portable context packet from one repo or session, import it into another repo. Packets carry: a Markdown summary, structured `nextSteps` instructions for the receiving agent, source-link references, included file bytes (copied into the bundle), a SHA-256 manifest, and optional `supersedes` / `replyTo` edges. CLI: `notch packet create --file <path> --next-steps "..."`, `notch packet import`, `notch packet list`, `notch packet show`, `notch packet preview`, `notch packet pack <id>` (produces a `.notchpkt` archive for cross-machine transport), `notch packet unpack <archive>`. MCP: `create_packet`, `import_packet`, `list_packets`, `get_packet`.

**Self-addressed permanent capture.** Solo-use packets that lower the adoption bar to "useful from day one even if you never send a packet to anyone." CLI: `notch mark --summary "..." --tags ...`. MCP: `create_mark`.

**Typed replies.** Author follow-ups against any record with a structured `replyType` (`question`, `clarification`, `counter-decision`, `objection`, `confirmation`) and a `status`. CLI: `notch reply <id> --type <type>`. MCP: `create_reply`.

**Private context seeding.** Carry user preferences and workflow conventions from a prior repo into a new repo's ignored `.notch/private/` namespace. CLI: `notch seed from <repo-or-store-path>`. MCP: `create_seed_packet`, `import_seed_packet`.

**Targeted briefs.** Produce a scoped task-context document an agent can read before work. CLI: `notch brief`, `notch brief create`, `notch brief list`, `notch brief show`. MCP: `get_brief`, `create_brief`, `list_briefs`, `get_targeted_brief`.

**Deterministic relationship index.** After every record write, an edge index (`.notch/index/relationships.json`) is rebuilt over `supersedes`, `replyTo`, `co-tagged`, `co-recipient`, and `co-source-link` relationships. Mechanical only — no semantic derivation.

**Corpus integrity check.** `notch check` runs deterministic structural rules over the corpus (broken `supersedes`, broken `replyTo`, cycles, self-references, supersedes forks). MCP: `check_store`. Verb is deliberately `check`, not `lint` — see Boundaries.

**Web-chat ingest fallback.** For browser chats that cannot reach local MCP, `notch prompt --client claude-chat` emits a paste-ready bridge prompt, and `notch packet import -` accepts a packet from stdin. This is a fallback, not a headline path — the structurally honest replacement (custom connectors / remote MCP) is flagged in the README's "Where We Want Help" section.

**Supporting commands.** `notch onboard`, `notch status`, `notch doctor`, `notch scan`, `notch mcp serve`. Supporting MCP tools: `get_status`, `run_doctor`.

## What 3Notch Does Not Do

3Notch deliberately does not ship same-repo same-session continuity tooling. That problem is solved well enough by CLAUDE.md / AGENTS.md, native tool memory (Claude Code `/memory` / `/compact` / session resume), git commits, and ad-hoc markdown. 3Notch's wedge is cross-boundary transport.

The following are explicitly out of scope, with a regression-guard test (`tests/unit/no-deferred-commands.test.ts`) preventing accidental reintroduction:

- `notch pass`, MCP `create_pass` / `get_latest_pass` / `get_recent_passes`
- `notch send` (the two-step create + import is fine)
- `notch decision *`, MCP `record_decision` / `get_decisions`
- `notch question *`, MCP `add_open_question` / `get_open_questions`
- `notch conflict *`, MCP `create_conflict` / `list_conflicts` / `resolve_conflict`
- `notch stale *`, MCP `mark_context_stale`

Also out of scope:

- Hosted SaaS, login, billing, teams, browser extensions, cloud dashboards.
- Hosted relay for packet delivery (the OS already moves files between machines via scp, rsync, Tailscale, Syncthing, iCloud, git).
- Identity, auth, signing of packets (hashing covers integrity; signing requires key management 3Notch does not own).
- Telemetry, hidden chat or project scraping, automatic historical reconstruction.
- Vector databases, semantic search, auto-tagging, similarity threading, contradiction flagging — any form of semantic derivation. The intelligence belongs to the user's agent reading the inbox, not to 3Notch writing it.
- Wiki / browse / graph UI over `relationships.json` — out of OSS core; contributor ecosystem territory.
- Cross-store / cross-user pattern aggregation. All forms. Held permanently in OSS.
- Encryption at rest for `.notch/private/`. OS-level disk encryption covers it.
- Agent orchestration, arbitrary shell execution through MCP, plugin marketplaces, enterprise policy controls, background daemons beyond `notch mcp serve`.
- A `lint` verb. Held permanently — the structural integrity surface is `check`. IP-hygiene rule to preserve the iPSM patent-claim boundary.

## Consent Model

The cross-tool handoff is explicit and reviewable. 3Notch never reads raw chat logs, Claude Project databases, or other client internals. The flow is:

1. A user asks an agent in Claude Desktop, Claude Code, Codex, or another MCP-capable client to create a 3Notch packet from selected project/session context — and, if relevant, to save the artifact files to disk first via the client's existing filesystem MCP.
2. The agent calls a local 3Notch MCP tool, supplies summary + intent + recipient + file paths.
3. 3Notch validates, scans the included bytes for secrets, hashes them, and writes a local packet folder under `.notch/outbox/` or `.notch/private/outbox/`.
4. The user can preview the packet (`notch packet preview <id>`) before moving it.
5. Another repo or tool imports the packet and reads it through CLI or MCP. Imported packets are immutable — the receiving folder is sealed, hashes are verified on import, and any attempted overwrite raises a hard error.

Private seed packets are hidden from MCP unless the server is started with `--include-private` for that process.

## Architecture Posture

- TypeScript CLI package distributed as `@3notch/cli` via npm.
- Local-first by default. No native dependencies (no SQLite, no node-gyp). `npx @3notch/cli onboard` works on Windows, macOS, and Linux without compilation.
- Markdown + YAML frontmatter source records under `.notch/`. JSON config. Derived JSON index files (rebuildable).
- Schema validation via Ajv + JSON Schema. Schema `$id` host: `https://3notch.dev/schemas/...`.
- MCP server via `@modelcontextprotocol/sdk` over stdio.
- Append-only audit log at `.notch/logs/audit.jsonl`.
- Secret scanning before writes — applied to record text and to text-like artifact bytes (extension allowlist); binaries skipped with a `scan-skip` audit entry.
- Strict path safety: source-link inputs must resolve under `config.project.root`; symlinks under `.notch/` are rejected; origin metadata in imported packets is preserved unchanged.
- Per-artifact and per-packet size caps (50 MB / 200 MB defaults, configurable; soft warn at 80%, hard reject at 100%).
- Inbox immutability enforced at write time and verified by SHA-256 manifest on import.

## Local Store Layout

```text
.notch/
  .gitignore            # ignores index/, logs/, private/
  config.json           # project-level config
  brief.md              # default project brief; cold-start primer
  briefs/               # targeted briefs
  inbox/                # imported packets (folder-form for V3+, single-file for V2-)
    <slug>/             # packet folder
      packet.md         # frontmatter + summary + nextSteps + manifest reference
      manifest.json     # SHA-256 + bytes per artifact
      artifacts/        # included file bytes
  outbox/               # created packets (same folder shape)
  private/
    inbox/              # imported private seed packets
    outbox/             # created private seed packets
  index/
    relationships.json  # derived edge index (rebuildable)
  logs/
    audit.jsonl         # append-only audit log
```

V2-era single-file packets (`<slug>.md` at the same level as folder-form packets) remain valid and readable indefinitely as a degenerate case.

## Killer Demo

> *I worked with Claude Desktop to design a brand showcase HTML and a mascot JPEG. I want to hand the whole thing — the bytes of both files, the design reasoning, the user preferences from this chat, and explicit instructions — to Codex so it can build the website. Without 3Notch I save files manually, copy-paste the reasoning into a Codex prompt, and re-explain everything. With 3Notch: Claude Desktop saves the artifacts via filesystem MCP, calls `create_packet --file showcase.html --file mascot.jpeg --next-steps "Build a one-page Next.js site at apps/brand-site/ using showcase.html as the layout and mascot.jpeg in the hero", the packet lands in Codex's inbox with hashes verified, and Codex reads `nextSteps` and the artifact bytes directly from the bundle.*

Same loop generalizes to any cross-boundary handoff: planning repo → implementation repo, contractor → in-house team, Claude Desktop → Codex CLI, prior project → new project, laptop → desktop via `notch packet pack` + the user's preferred transport (scp, rsync, Tailscale, iCloud, git, Syncthing).

## Target User Archetype

Solo operators and small teams running multiple businesses or client engagements across multiple AI tools and repos. Specifically:

- Indie founders using one tool for planning and another for implementation.
- Consultants moving working context between client projects.
- Power users who switch primary AI tools as the best one shifts month-over-month.
- Small agencies where engineering and marketing/copy work happen in different tools but depend on the same project state.

Not the initial target: large engineering teams with a single committed tool stack and centralized DevOps. Those have other tools and other problems.

## Distribution

- Open-source core, MIT licensed.
- `@3notch/cli` on npm. `npx @3notch/cli onboard` as the install path.
- Project domain: `3notch.dev`.
- No hosted layer. No relay. No managed service. The OSS core does not paint into a commercial corner — but no commercial corner is being built. Cross-machine transport uses whatever channel the user already has (scp, rsync, Tailscale, iCloud, Syncthing, git); `notch packet pack` produces a portable `.notchpkt` archive for that flow.
- A "Where We Want Help" section in the README flags areas open to community contribution: connector / remote-MCP mode for web-chat ingest, cross-machine transport recipes, DXT packaging, agent prompt packs for capture, reply-surfacing UX, browse/wiki surfaces over `relationships.json`, additional `check` rules, scanner rule contributions, encryption at rest.

## Brand

Canonical forms (hard rules; enforce in every surface):

- Display name: `3Notch` (capital T, capital N, no space, no hyphen)
- CLI command: `notch` (lowercase, single word)
- npm package: `@3notch/cli`
- Domain: `3notch.dev`
- Schema `$id` host: `https://3notch.dev/schemas/...`

Visual mark: three parallel horizontal mark-red lines (`#E04E2C`) on ink (`#0B0A08`). Wordmark in Geist 600 with `-0.025em` tracking and the leading `3` colored mark-red. Tagline: **Mark your trail.**

Brand system (palette, typography, mascot surface-restriction rules, canonical-form rules) is maintained outside this repo.

## Success Signals

The product is succeeding when:

1. A solo operator can run `npx @3notch/cli onboard` in a fresh repo, seed it from a prior project's `.notch/`, and have user preferences carry over without committing them.
2. An agent in Claude Code can create a packet describing current repo state, and an agent in Claude Desktop can import and read it without copy-paste.
3. A planning-repo packet can be created in repo A, imported into implementation-repo B, and read by an agent in B before work starts.
4. The brand-handoff lived case works end-to-end: an agent on one tool produces files + summary + intent; an agent on another tool consumes the bundle and acts on it; the bytes never pass through the user's clipboard.
5. A user moves a packet from one machine to another via their existing transport (scp, iCloud, git) and the receiving machine verifies and imports it cleanly.
6. All of the above work locally with no cloud dependency, no telemetry, and no chat-history scraping.
7. The OSS repo passes lint, type-check, build, tests, and e2e tests in CI across Ubuntu, macOS, and Windows on Node 20 and 22.
8. README quickstart runs end-to-end from a fresh clone.

## Reference Documents

- `AGENTS.md` — shipping conventions, boundaries, the lint-verb permanent hold, deferred-verb regression guard.
- `docs/archived-plans/v3/3notch-v3-plan.md` — V3 plan (folder-canonical packets with artifacts); shipped.
- `docs/archived-plans/v2/3notch-v2-plan.md` — V2 substrate (mark, reply, check, relationships, web-chat bridge); shipped.
- `docs/archived-plans/v1.1/3notch-v1.1-plan.md` — V1.1 plan; shipped.
- `docs/archived-plans/v1/3notch-v1-technical-spec.md` — V1 architecture and contract; shipped.
- `docs/reference/privacy.md`, `docs/reference/security-story.md` — privacy posture and security model.
- `README.md` — public-facing quickstart, command reference, and "Where We Want Help" section.
