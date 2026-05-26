# 3Notch Docs

Documentation for the 3Notch CLI and MCP server.

## Guides

Task-shaped how-tos for the main flows.

- [Cross-repo packets](guides/cross-repo-packets.md) — create, preview, import; `--file` vs `--ref`; pack/unpack.
- [Cross-tool handoff](guides/cross-tool-handoff.md) — same-store, cross-repo, cross-machine, and web-chat shapes.
- [Private context seeding](guides/private-context-seeding.md) — carrying reviewed preferences into a new repo.
- [Targeted brief workflow](guides/targeted-brief-workflow.md) — scoped task briefs vs cross-boundary packets.
- [MCP setup](guides/mcp-setup.md) — server flags, available tools, agent instruction packs.

## Reference

Project posture and security model.

- [Privacy](reference/privacy.md) — what 3Notch does and does not do with your data.
- [Security story](reference/security-story.md) — curate, scan, audit, review, preserve.

## Prompts

Paste-ready agent prompts for common handoffs.

- [Claude Desktop → Claude Code](prompts/claude-desktop-to-claude-code.md)
- [Cross-repo handoff](prompts/cross-repo-handoff.md)
- [Private seed from prior work](prompts/private-seed-from-prior-work.md)
- [Web chat → project](prompts/web-chat-to-project.md)

## Plans

Historical record of how the project was built. Read these only if you want to understand decisions or pick up where a version left off.

- [archived-plans/v1/](archived-plans/v1/) — V1 spec and implementation plan.
- [archived-plans/v1.1/](archived-plans/v1.1/) — V1.1 hardening and web-chat bridge.
- [archived-plans/v2/](archived-plans/v2/) — V2 substrate (marks, replies, relationships, check).
- [archived-plans/v3/](archived-plans/v3/) — V3 artifact bundles and folder-canonical packets.
- [archived-plans/3notch-project-request.md](archived-plans/3notch-project-request.md) — original project framing.

Future plans land under `docs/active-plans/<version>/` during development and move to `docs/archived-plans/` when the version ships.
