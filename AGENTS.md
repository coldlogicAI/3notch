# 3Notch Agent Guide

## Purpose

3Notch is a local-first CLI and MCP server for moving project context across boundaries that built-in AI tooling cannot cross — across repos, across AI work surfaces, and into new projects. V1 ships exactly three loops: packet transfer, private context seeding, and targeted briefs. Supporting commands: onboard, status, doctor, mcp serve.

## Read First

1. `docs/3notch-v1-technical-spec.md`
2. `docs/3notch-v1-implementation-plan.md`
3. `docs/3notch-project-request.md`
4. `docs/3notch-branding-review.md`

## Long-Run Goal

For a persistent V1 implementation run, use `Prompts/3notch-v1-goal.md` as the paste-ready `/goal` prompt. During that run, append concise progress entries to `docs/v1-implementation-log.md` after each coherent slice or wave.

## V1 Surface (build this, nothing else)

CLI commands:
- `notch onboard`
- `notch brief`, `notch brief create`, `notch brief list`, `notch brief show <id>`
- `notch packet create`, `notch packet import <file>`, `notch packet list`, `notch packet show <id>`
- `notch seed from <repo-or-store-path>`
- `notch status`
- `notch doctor`
- `notch mcp serve`

MCP tools:
- `get_brief`, `create_brief`, `list_briefs`, `get_targeted_brief`
- `create_packet`, `import_packet`, `list_packets`, `get_packet`
- `create_seed_packet`, `import_seed_packet`
- `get_status`, `run_doctor`

## Deferred From V1 (do not implement)

These are deliberately out of scope. Same-repo same-tool continuity is solved by CLAUDE.md, native tool memory, and `git commit`. 3Notch's wedge is cross-boundary transport.

- `notch pass`, MCP `create_pass`/`get_latest_pass`/`get_recent_passes`
- `notch send` (sugar for create + import; the two-step is fine)
- `notch decision *`, MCP `record_decision`/`get_decisions`
- `notch question *`, MCP `add_open_question`/`get_open_questions`
- `notch conflict *`, MCP `create_conflict`/`list_conflicts`/`resolve_conflict`
- `notch stale *`, MCP `mark_context_stale`

A regression-guard test (`tests/unit/no-deferred-commands.test.ts`) prevents accidental re-introduction.

## Boundaries

- Do not implement the full V1 plan unless the user asks for that session.
- When the user presents a product idea or asks "is this the right path?", discuss and pressure-test it before changing specs, plans, or repo files.
- Treat cross-repo packets as core V1.
- Treat private context seeding as core V1.
- Treat cross-tool handoff as the product direction: Claude Desktop, Claude Code, Codex, Cursor, ChatGPT exchange context through explicit reviewable packets, not copy-paste.
- No telemetry, cloud sync, hosted service, dashboard, vector database, or SQLite/native DB for V1.
- Do not build hidden chat or project scraping. MCP tools write selected or summarized context the user/agent explicitly supplies during a session.
- Preserve human-readable `.notch/` source files as the source of truth.
- Use `.notch/outbox/` for created packets, `.notch/inbox/` for imported packets, and ignored `.notch/private/` for user preferences, workflow conventions, and seed packets.
- Treat `.notch/index/` and `.notch/logs/` as derived/noisy output.
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
node dist/cli/index.js --help
```

## Done Criteria

Run lint, type-check, build, tests, and a built CLI smoke check before claiming implementation work is done. Keep commits focused and leave the repo clean.
