# 3Notch Agent Guide

## Purpose

3Notch is a local-first CLI and MCP server for passing project context across repos and AI agents. V1 should prove the packet loop first: create a packet in repo A, import/read it in repo B, then support project brief, targeted briefs, passes, decisions, open questions, stale assumptions, conflicts, status, and doctor checks.

## Read First

1. `3notch-v1-technical-spec.md`
2. `3notch-v1-implementation-plan.md`
3. `3notch-project-request.md`
4. `3notch-branding-review.md`

## Boundaries

- Do not implement the full V1 plan unless the user asks for that session.
- Treat cross-repo packets as core V1 behavior, not a later export feature.
- No telemetry, cloud sync, hosted service, dashboard, vector database, or SQLite/native DB for V1.
- Preserve human-readable `.notch/` source files as the source of truth.
- Use `.notch/outbox/` for created packets and `.notch/inbox/` for imported packets.
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
