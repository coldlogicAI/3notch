# Changelog

All notable changes to 3Notch will be documented in this file.

## Unreleased

- No unreleased changes.

## 0.4.0 - 2026-05-25

- Add folder-canonical packet bundles with `packet.md`, optional `manifest.json`, and bundled `artifacts/`.
- Add packet `artifacts[]` and `nextSteps` schema fields.
- Change `--file` to copy artifact bytes by default and add `--ref` for V2 pointer-only behavior.
- Record SHA-256 and byte size for artifacts in both packet frontmatter and `manifest.json`.
- Add `notch packet pack` and `notch packet unpack` for deterministic `.notchpkt` gzipped tar archives.
- Extend scanner coverage over text-like artifacts and audit binary `scan-skip` events.
- Enforce artifact size caps: 50MB per artifact, 200MB per packet, with 80% soft warnings.
- Bump new packet schema version to `0.4.0`.
- Keep V2 single-file packets readable without migration.

## 0.3.0 - 2026-05-24

- Add `supersedes`, `replyTo`, `replyType`, and reply `status` packet fields.
- Add deterministic `.notch/index/relationships.json` with explicit relationship edges.
- Add `notch mark` and MCP `create_mark` for self-addressed private capture.
- Add `notch reply` and MCP `create_reply` for typed packet replies.
- Add `notch prompt --client claude-chat` and `notch packet import -` for web-chat packet intake.
- Add `notch check` and MCP `check_store` for the five V2 structural corpus checks.
- Surface a corpus-check summary in `notch doctor`.
- Enforce and document the received-packet immutability guarantee.

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
