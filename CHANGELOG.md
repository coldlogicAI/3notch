# Changelog

All notable changes to 3Notch will be documented in this file.

## Unreleased

- No unreleased changes.

## 0.2.0 - 2026-05-24

- Add `notch prompt --client <client>` agent instruction packs for Claude Code, Claude Desktop, Codex, and Cursor.
- Extend `notch onboard --mcp` with Claude Code `.mcp.json` auto-config and Claude Desktop config auto-config with backup writes.
- Improve manual MCP setup snippets for Codex, Cursor, and ChatGPT Desktop.
- Add `notch scan <file-or-stdin>` for standalone sensitive-pattern scanning.
- Add `notch packet preview <id>` to show the agent-visible packet view and current scanner warnings.
- Add the V1.1 security story doc and update the quickstart around agent-driven same-store handoff.

## 0.1.0 - 2026-05-24

- Bootstrap repository structure for V1 implementation.
- Add initial TypeScript CLI skeleton for help and version output.
- Scope V1 to three loops — packet transfer, private context seeding, targeted briefs — plus onboard/status/doctor/mcp serve. Defer pass, send, decision, question, conflict, and stale commands and their MCP equivalents; same-repo same-session continuity is covered by CLAUDE.md, native tool memory, and `git commit`. Regression-guard tests prevent re-introduction.
- Reframe positioning around tool-portable context for the multi-agent era: "Your AI tools will change. Your project context shouldn't have to."
- Update killer demo to the Claude Desktop ↔ Claude Code marketing-copy-from-repo-state flow.
