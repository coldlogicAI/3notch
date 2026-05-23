# 3Notch V1 Repo Rules

- Keep 3Notch local-first in V1. Do not add telemetry, analytics, hosted sync, or cloud dependencies.
- Treat cross-repo packets as the core V1 product loop: source repo outbox, destination repo inbox, CLI/MCP readable after import.
- Treat private context seeding as core V1: prior work can seed a new repo through ignored `.notch/private/` packets.
- Treat cross-tool handoff as core product direction: Claude Desktop, Claude Code, Codex, and other AI tools exchange context through explicit reviewable packets.
- Do not add SQLite, native database bindings, vector databases, semantic search services, dashboards, or broad orchestration before the V1 handoff workflow works.
- Do not implement hidden chat/project scraping. User-invoked MCP tools can store selected or summarized session context, but 3Notch must not silently extract private conversations or project data.
- Preserve human-readable `.notch/` source files. Derived `.notch/index/` and `.notch/logs/` output must be rebuildable.
- Do not silently merge imported packet contents into destination source records.
- Do not expose `.notch/private/` through MCP unless the user explicitly enables private context for that server/session.
- Do not expose arbitrary shell execution through MCP.
- Do not run destructive Git operations or create/push GitHub remotes without explicit user approval.
- Prefer small, verified CLI/core slices that follow `3notch-v1-implementation-plan.md`.
