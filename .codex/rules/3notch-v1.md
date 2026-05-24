# 3Notch V1 Repo Rules

- Keep 3Notch local-first in V1. Do not add telemetry, analytics, hosted sync, or cloud dependencies.
- Treat cross-repo packets as the core V1 product loop: source repo outbox, destination repo inbox, CLI/MCP readable after import.
- Treat private context seeding as core V1: prior work can seed a new repo through ignored `.notch/private/` packets.
- Treat cross-tool handoff as core direction: Claude Desktop, Claude Code, Codex, Cursor, ChatGPT exchange context through explicit reviewable packets.
- V1 ships exactly three loops: packet transfer, private context seeding, targeted briefs. Plus supporting commands: onboard, status, doctor, mcp serve.
- Do not implement `notch pass`, `notch send`, `notch decision *`, `notch question *`, `notch conflict *`, or `notch stale *`. These compete with CLAUDE.md, native tool memory, and `git commit` for same-repo discipline the community does not maintain in dedicated tools. A regression-guard test enforces this.
- Do not add SQLite, native database bindings, vector databases, semantic search services, dashboards, or broad orchestration before the V1 cross-boundary workflow works.
- Do not implement hidden chat/project scraping. User-invoked MCP tools can store selected or summarized session context, but 3Notch must not silently extract private conversations or project data.
- Preserve human-readable `.notch/` source files. Derived `.notch/index/` and `.notch/logs/` output must be rebuildable.
- Do not silently merge imported packet contents into destination source records.
- Do not expose `.notch/private/` through MCP unless the user explicitly enables private context for that server/session via `--include-private`.
- Do not expose arbitrary shell execution through MCP.
- Do not run destructive Git operations or create/push GitHub remotes without explicit user approval.
- Prefer small, verified CLI/core slices that follow the active plan in `docs/active-plans/` (currently `docs/active-plans/v1.1/3notch-v1.1-plan.md`). The V1 spec at `docs/archived-plans/v1/3notch-v1-technical-spec.md` remains authoritative for architecture invariants.
