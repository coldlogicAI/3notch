# Contributing

Thanks for helping make 3Notch useful.

## Development Setup

```bash
npm install
npm run lint
npm run type-check
npm run build
npm test
```

## Scope

3Notch V1 is a local-first CLI and MCP server for moving project context across boundaries built-in AI tooling cannot cross: across repos, across AI work surfaces, and into new projects. Keep changes aligned with the V1 spec and implementation plan.

V1 ships exactly three loops: **packet transfer**, **private context seeding**, **targeted briefs**. Plus supporting commands: onboard, status, doctor, mcp serve.

Avoid adding hosted services, telemetry, native databases, semantic search dependencies, dashboards, broad agent orchestration, session-end pass commands, or decision/question/conflict/stale record types before the V1 cross-boundary workflow is working. Same-repo same-session continuity is intentionally deferred — CLAUDE.md, native tool memory, and `git commit` already cover it.

## Pull Requests

- Keep changes small and reviewable.
- Add or update tests for behavior changes.
- Preserve human-readable `.notch/` source files.
- Do not commit generated output from `dist/`, `coverage/`, `.notch/index/`, or `.notch/logs/`.
- Do not commit `.notch/private/` (already gitignored).

## Maintainer Notes

Files under `.notch/private/worker-briefs/` are local operating prompts for parallel implementation workers during long-running `/goal` sessions. They live in the ignored `.notch/private/` namespace because they are maintainer-internal, not part of the public contributor surface. Contributors do not need them.
