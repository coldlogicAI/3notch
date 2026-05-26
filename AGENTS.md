# 3Notch Agent Guide

## Purpose

3Notch is a local-first CLI and MCP server for moving project context across boundaries that built-in AI tooling cannot cross — across repos, across AI work surfaces, web chats, and into new projects. V3 is the current shipped surface: packet transfer with artifact bundles, private context seeding, targeted briefs, self-addressed marks, typed packet replies, web-chat stdin intake, relationship indexing, deterministic corpus checks, and `.notchpkt` pack/unpack for cross-machine transport. Supporting commands: `onboard`, `status`, `doctor`, `mcp serve`.

## Read First

V3 is shipped. Version plans are archived under `docs/archived-plans/` as historical record:

1. `docs/archived-plans/v3/3notch-v3-plan.md` — current architecture (folder-canonical packets, artifact bundles, `nextSteps`, pack/unpack).
2. `docs/archived-plans/v2/3notch-v2-plan.md` — V2 substrate (marks, replies, `supersedes`, relationships, check, web-chat bridge).
3. `docs/archived-plans/v1.1/3notch-v1.1-plan.md` — V1.1 hardening.
4. `docs/archived-plans/v1/3notch-v1-technical-spec.md` — V1 architecture and contract.
5. `docs/archived-plans/3notch-project-request.md` — original project framing.

Future version plans land under `docs/active-plans/<version>/` during development and move to `docs/archived-plans/` when shipped.

## Long-Run Goal

`/goal` prompts are an end-of-session deliverable, not a repo artifact. At the close of a planning or build session, when the next logical build is in view, produce a comprehensive paste-ready `/goal` prompt for that next session and deliver it inline in the chat as a copy-paste Markdown block. Do not write `/goal` prompts to files in the repo — the user copies them into the next session manually.

Constraints on the prompt:

- Keep it under 4,000 characters.
- Reference the relevant repo docs (the active plan, schemas, services) by path rather than embedding the full plan inline.
- Include only the load-bearing framing the next session needs to act on, not the reasoning that produced the plan.

During an active implementation run, append concise progress entries to the active plan's implementation log (e.g., `docs/active-plans/v4/v4-implementation-log.md`) after each coherent slice or wave. Past version logs are preserved under `docs/archived-plans/` as historical records.

## Shipped Surface (build this, nothing else)

CLI commands:
- `notch onboard`
- `notch mark`
- `notch reply <id>`
- `notch brief`, `notch brief create`, `notch brief list`, `notch brief show <id>`
- `notch packet create`, `notch packet import <file>`, `notch packet import -`, `notch packet list`, `notch packet show <id>`, `notch packet preview <id>`
- `notch packet pack <id>`, `notch packet unpack <archive>`
- `notch seed from <repo-or-store-path>`
- `notch prompt --client <client>`
- `notch scan <file-or-stdin>`
- `notch status`
- `notch check`
- `notch doctor`
- `notch mcp serve`

MCP tools:
- `get_brief`, `create_brief`, `list_briefs`, `get_targeted_brief`
- `create_packet`, `import_packet`, `list_packets`, `get_packet`
- `create_seed_packet`, `import_seed_packet`
- `create_mark`, `create_reply`, `check_store`
- `get_status`, `run_doctor`

## Deferred (do not implement)

These are deliberately out of scope. Same-repo same-tool continuity is solved by CLAUDE.md, native tool memory, and `git commit`. 3Notch's wedge is cross-boundary transport.

- `notch pass`, MCP `create_pass`/`get_latest_pass`/`get_recent_passes`
- `notch send` (sugar for create + import; the two-step is fine)
- `notch decision *`, MCP `record_decision`/`get_decisions`
- `notch question *`, MCP `add_open_question`/`get_open_questions`
- `notch conflict *`, MCP `create_conflict`/`list_conflicts`/`resolve_conflict`
- `notch stale *`, MCP `mark_context_stale`

A regression-guard test (`tests/unit/no-deferred-commands.test.ts`) prevents accidental re-introduction.

## Boundaries

- When the user presents a product idea or asks "is this the right path?", discuss and pressure-test it before changing specs, plans, or repo files.
- Treat cross-repo packets, cross-tool handoff, and private context seeding as the core product loops.
- No telemetry, cloud sync, hosted service, dashboard, vector database, or SQLite/native DB.
- Do not build hidden chat or project scraping. MCP tools write selected or summarized context the user or agent explicitly supplies during a session.
- Preserve human-readable `.notch/` source files as the source of truth.
- Use `.notch/outbox/` for created packets, `.notch/inbox/` for imported packets, and ignored `.notch/private/` for user preferences, workflow conventions, and seed packets.
- Treat `.notch/index/` and `.notch/logs/` as derived/noisy output.
- Keep `notch check` deterministic and structural only: broken `supersedes`, broken `replyTo`, supersedes cycle, self-reference, supersedes fork.
- Never ship a `lint` verb in 3Notch OSS.
- Do not add semantic derivation, auto-tagging, similarity threading, contradiction flagging, wiki UI, graph view, or cross-store aggregation.
- Do not expose `.notch/private/` through MCP unless the server is started with `--include-private`.
- Do not expose arbitrary shell execution through MCP.
- Do not run destructive Git commands or create/push remotes without approval.
- Do not re-introduce any of the deferred commands above without explicit user direction.

## Commands

```bash
npm install
npm run lint
npm run type-check
npm run build
npm test
npm run test:e2e
node dist/cli/index.js --help
```

## Done Criteria

Run lint, type-check, build, unit tests, e2e tests, and a built-CLI smoke check before claiming implementation work is done. Keep commits focused and leave the repo clean.
