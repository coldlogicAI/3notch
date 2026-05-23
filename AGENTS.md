# 3Notch Agent Guide

## Purpose

3Notch is a local-first CLI and MCP server for passing project and private workflow context across repos, Claude Desktop, Claude Code, Codex, and other AI work surfaces. V1 should prove the useful loops first: seed a new repo privately from prior work, create a reviewed packet from an active tool/session, import/read it in another repo or tool, then support project brief, targeted briefs, passes, decisions, open questions, stale assumptions, conflicts, status, and doctor checks.

## Read First

1. `3notch-v1-technical-spec.md`
2. `3notch-v1-implementation-plan.md`
3. `3notch-project-request.md`
4. `3notch-branding-review.md`

## Long-Run Goal

For a persistent V1 implementation run, use `Prompts/3notch-v1-goal.md` as the paste-ready `/goal` prompt. During that run, append concise progress entries to `docs/v1-implementation-log.md` after each coherent slice or wave.

## Boundaries

- Do not implement the full V1 plan unless the user asks for that session.
- When the user presents a product idea or asks "is this the right path?", discuss and pressure-test it before changing specs, plans, or repo files.
- Treat cross-repo packets as core V1 behavior, not a later export feature.
- Treat private context seeding as core V1 behavior, not scope creep.
- Treat cross-tool handoff as the product direction: Claude Desktop/Claude Code/Codex should exchange context through explicit 3Notch packets, not copy-paste.
- No telemetry, cloud sync, hosted service, dashboard, vector database, or SQLite/native DB for V1.
- Do not build hidden chat/project scraping. MCP tools may write selected or summarized context that the user/agent explicitly supplies during a session.
- Preserve human-readable `.notch/` source files as the source of truth.
- Use `.notch/outbox/` for created packets and `.notch/inbox/` for imported packets.
- Use ignored `.notch/private/` for user preferences, workflow conventions, and seed packets.
- Treat `.notch/index/` and `.notch/logs/` as derived/noisy output.
- Do not run destructive Git commands or create/push remotes without approval.

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

Run lint, type-check, build, tests, and a built CLI smoke check before claiming implementation work is done. Keep commits focused and leave the repo in a clean state.
