# Baton V1 Repo Rules

- Keep Baton local-first in V1. Do not add telemetry, analytics, hosted sync, or cloud dependencies.
- Do not add SQLite, native database bindings, vector databases, semantic search services, dashboards, or broad orchestration before the V1 handoff workflow works.
- Preserve human-readable `.baton/` source files. Derived `.baton/index/` and `.baton/logs/` output must be rebuildable.
- Do not expose arbitrary shell execution through MCP.
- Do not run destructive Git operations or create/push GitHub remotes without explicit user approval.
- Prefer small, verified CLI/core slices that follow `baton-v1-implementation-plan.md`.
