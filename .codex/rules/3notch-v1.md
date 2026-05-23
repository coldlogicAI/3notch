# 3Notch V1 Repo Rules

- Keep 3Notch local-first in V1. Do not add telemetry, analytics, hosted sync, or cloud dependencies.
- Treat cross-repo packets as the core V1 product loop: source repo outbox, destination repo inbox, CLI/MCP readable after import.
- Do not add SQLite, native database bindings, vector databases, semantic search services, dashboards, or broad orchestration before the V1 handoff workflow works.
- Preserve human-readable `.notch/` source files. Derived `.notch/index/` and `.notch/logs/` output must be rebuildable.
- Do not silently merge imported packet contents into destination source records.
- Do not expose arbitrary shell execution through MCP.
- Do not run destructive Git operations or create/push GitHub remotes without explicit user approval.
- Prefer small, verified CLI/core slices that follow `3notch-v1-implementation-plan.md`.
