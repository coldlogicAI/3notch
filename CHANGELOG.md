# Changelog

All notable changes to 3Notch are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-07-19

### Added
- Opt-in Claude Code continuation checkpoints with script, prompt, and auto modes.
- Non-blocking SessionStart, task, post-compaction, rate-limit, and optional Stop hook handling without transcript reads.
- Stream-aware continuation packet chains, structured task aggregation, Git provenance, and confirmation-gated resume offers.
- Packet tag and `supersedes` parity across CLI and MCP, plus tag-filtered packet listing.
- Repo hygiene: expanded `.gitignore` for IDE state, vim swap, Vitest cache, Windows OS junk, and per-developer AI assistant directories.
- Documentation index at `docs/README.md`; restructured guides under `docs/guides/` and reference docs under `docs/reference/`.
- `notch onboard` now creates `.notch/README.md` with durable agent-facing handoff instructions.
- Unit coverage for V3 packet folder immutability (`packet.md`, `manifest.json`, `artifacts/*` overwrite attempts) and for hostile `.notchpkt` archives (path traversal, absolute paths, unexpected top-level entries).
- Unit coverage for V2 single-file `pack` / `unpack` round-trip.

### Changed
- Packet imports now use a short-lived local store lock so retries and simultaneous writers cannot create duplicate IDs or leave ambiguous packet lookup.
- `assertImmutablePacketFolder` is now called before bundle writes so the "sealed folder" contract is enforced at write time, not just implied by collision suffixing.
- `notch onboard` now points users to `.notch/README.md` first and keeps `notch prompt` as a web-chat / copy-paste fallback.
- Common `--file <path:purpose>` aliases such as `:favicon`, `:icon`, `:logo`, and `:image` normalize to `asset`; unknown labels fail with a clear artifact-purpose error.
- All user-facing docs rewritten to be version-agnostic and current to V3 (artifact bundling, `nextSteps`, pack/unpack, full MCP tool surface).

### Fixed
- `notch --version` now matches the published package version, with regression coverage preventing future drift.

### Removed
- Stale `docs/website-branding/` (brand source files are maintained outside this repo).
- Stale `.codex/rules/3notch-v1.md` (V1-only rules; AI assistant rule files are per-developer).
- Dead `mtime: 0` option on `gzipSync` in archive-service. Archive determinism still holds via Node's default-zeroed gzip mtime.

## [0.4.0] - 2026-05-25

### Added
- Folder-canonical packet bundles with `packet.md`, optional `manifest.json`, and bundled `artifacts/`.
- Packet `artifacts[]` and `nextSteps` schema fields.
- `--ref <path>` for pointer-only packets when both sides share the same workspace path.
- `notch packet pack` and `notch packet unpack` for deterministic `.notchpkt` gzipped tar archives.
- Scanner coverage over text-like artifacts; audit log records binary `scan-skip` events.
- Artifact size caps: 50 MB per artifact, 200 MB per packet, with 80% soft warnings.

### Changed
- `--file <path>` now copies artifact bytes by default (was pointer-only in V2).
- New packet `schemaVersion` is `0.4.0`. V2 single-file packets remain readable without migration.

## [0.3.0] - 2026-05-24

### Added
- Packet `supersedes`, `replyTo`, `replyType`, and reply `status` fields.
- Deterministic `.notch/index/relationships.json` with explicit relationship edges.
- `notch mark` and MCP `create_mark` for self-addressed private capture.
- `notch reply` and MCP `create_reply` for typed packet replies.
- `notch prompt --client claude-chat` and `notch packet import -` for web-chat packet intake.
- `notch check` and MCP `check_store` for five structural corpus checks.
- Corpus-check summary surfaced in `notch doctor`.

### Changed
- Documented and enforced the received-packet immutability guarantee.

## [0.2.0] - 2026-05-24

### Added
- `notch prompt --client <client>` agent instruction packs for Claude Code, Claude Desktop, Codex, and Cursor.
- Claude Code `.mcp.json` and Claude Desktop config auto-write (with backup) through `notch onboard --mcp`.
- Manual MCP setup snippets for Codex, Cursor, and ChatGPT Desktop.
- `notch scan <file-or-stdin>` for standalone secret scanning.
- `notch packet preview <id>` showing the agent-visible packet view plus current scanner warnings.
- V1.1 security story doc.

### Changed
- Quickstart reframed around agent-driven same-store handoff.

## [0.1.0] - 2026-05-24

### Added
- TypeScript CLI skeleton with `--help` and `--version`.
- Initial V1 scope: three loops (packet transfer, private context seeding, targeted briefs) plus supporting commands (`onboard`, `status`, `doctor`, `mcp serve`).
- Positioning around tool-portable context for the multi-agent era.
- Regression-guard test preventing re-introduction of deferred commands (`pass`, `send`, `decision *`, `question *`, `conflict *`, `stale *`).
