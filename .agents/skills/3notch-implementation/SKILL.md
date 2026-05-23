# 3Notch Implementation

Use this skill when implementing 3Notch V1 features.

## Workflow

1. Read `3notch-v1-technical-spec.md` for authoritative architecture and V1 boundaries.
2. Read the relevant wave in `3notch-v1-implementation-plan.md`.
3. Keep the public product focused on private context seeding, cross-repo packets, and cross-tool handoff between Claude Desktop, Claude Code, Codex, and future agent tools.
4. For MCP work, treat Claude Desktop/Claude Code/Codex as explicit packet writers/readers. Do not build hidden chat/project scraping.
5. For seed work, write user preferences/workflow context under ignored `.notch/private/` and gate MCP exposure explicitly.
6. For transfer work, preserve the source outbox/destination inbox model and avoid silent merge into destination records.
7. Implement the smallest useful CLI/core slice and test it.
8. Stop before adding hosted sync, telemetry, SQLite/native DB, semantic search, dashboards, broad orchestration, DXT packaging, or remote connectors unless the plan is explicitly updated.

## Verification

Run:

```bash
npm run lint
npm run type-check
npm run build
npm test
```
