# Implementation Plan: 3Notch V1.1

## Status

V1 is shipped. The technical spec (`docs/archived-plans/v1/3notch-v1-technical-spec.md`) remains authoritative for architecture, data model, store layout, security boundaries, and error codes. V1.1 does not change those invariants; it adds commands, removes friction, and sharpens the security story.

## Scope (three themes, nothing else)

1. **Agent-driven packet creation.** The user talks to their agent normally — "package this week's LinkedIn updates for the desktop agent" — and the agent uses 3Notch's existing MCP tools to do it. No new CLI ritual. The work is in agent discoverability, not new tool surface.
2. **Setup friction reduction.** First-run MCP configuration becomes one command per client, not "follow these printed instructions." Same-store cross-tool pattern documented as the default recommended setup.
3. **Concrete security story.** Make the curate/scan/audit/review pitch real with tools the user actually runs: standalone secret scanner, explicit packet preview, secret-scanner UX that doesn't trap on benign documentation prose.

## The Steinberger Filter

Every item below passed this test: *would Peter Steinberger ship this, or would he say "remove it, it pollutes context and the alternative is faster"?*

Items that did **not** pass and are explicitly **out of scope for V1.1**:

- `notch packet update <id>` for refreshing recurring packets. Just create a new packet with the same title. Versioning by recency is fine; an update command buys nothing.
- `notch audit` CLI report. Real value only at incident or compliance time. Defer until a user asks.
- Per-packet redaction patterns. Over-engineered. Use the global patterns or rephrase the source.
- Hub `.notch/` aggregator for multi-project Claude Desktop. Premature architecture. Document "one project at a time" honestly until users prove they need more.
- Encryption at rest for private packets. V2. Disk encryption is the OS's job in V1.x.
- `notch packet diff <id1> <id2>`. If you need to compare, open both with `show`. Don't build a command without proven need.
- New MCP tools. The existing 12 cover the workflows. Adding tools adds context tax for every agent that loads them.

The principle: **ship less than feels comfortable; make what's there obvious to use.**

## Assumptions

- V1 implementation is complete and tested. 100 unit/schema/cli/mcp tests + 4 e2e tests passing on macOS/Ubuntu/Windows × Node 20/22.
- The V1 architecture (Markdown+YAML records, local file store, Ajv schema validation, file-scan index, stdio MCP, audit log, path safety, secret scan) does not change.
- V1.1 introduces three new CLI commands (`notch prompt`, `notch scan`, `notch packet preview` — though `preview` may resolve as an alias for `show`) and extends `notch onboard` to actually mutate two known client configs.
- No new MCP tools. No new record types. No new schemas.
- The audit log and path safety semantics from V1 cover the new commands automatically.

## Wave 1: Agent-Driven Workflow (the headline)

The single highest-leverage change in V1.1. Turns "I have to remember to invoke a CLI" into "I ask my agent normally and it works."

- [x] **Step 1.1: `notch prompt --client <client>` command**
  - **Files:**
    - `src/cli/commands/prompt.ts` - NEW
    - `src/cli/prompts/claude-code.ts` - NEW
    - `src/cli/prompts/claude-desktop.ts` - NEW
    - `src/cli/prompts/codex.ts` - NEW
    - `src/cli/prompts/cursor.ts` - NEW
    - `src/cli/program.ts` - MODIFIED
    - `tests/cli/prompt.test.ts` - NEW
  - **Implementation:** prints a short, paste-ready agent instruction block tailored to one client. Each instruction names the V1 MCP tool surface (`get_brief`, `create_packet`, `import_packet`, etc.) and teaches the agent to invoke them when the user asks for handoff/transfer/packaging behavior. No additional MCP tools are exposed; this is pure prompt content.
  - **Output shape:** plain text by default, JSON with `--json` (for scripted onboarding flows). The text version is copy-pasteable into the destination file (CLAUDE.md, AGENTS.md, Claude Desktop project instructions).
  - **Verification:** `npm test -- prompt`; output for each client contains all V1 MCP tool names; output does NOT mention any deferred surface (`pass`, `send`, `decision`, `question`, `conflict`, `stale`).

- [x] **Step 1.2: `notch onboard` outputs prompt-pack snippet in completion summary**
  - **Files:**
    - `src/cli/commands/onboard.ts` - MODIFIED
    - `tests/cli/onboard.test.ts` - MODIFIED
  - **Implementation:** after store creation, when `--mcp <client>` is supplied, append the corresponding agent instructions from Step 1.1 to the completion output. Without `--mcp`, print a one-line hint pointing to `notch prompt --client <client>`.
  - **Verification:** `notch onboard --yes --mcp claude-code` output contains an `Agent Instructions` section with text matching `notch prompt --client claude-code`.

- [x] **Step 1.3: Refresh `docs/prompts/*` files with the agent-driven flow**
  - **Files:**
    - `docs/prompts/claude-desktop-to-claude-code.md` - MODIFIED
    - `docs/prompts/cross-repo-handoff.md` - MODIFIED
    - `docs/prompts/private-seed-from-prior-work.md` - MODIFIED
  - **Implementation:** rewrite each prompt to lead with the conversational pattern ("ask the agent to package X for Y") rather than describing tool calls. The agent figures out the tool calls. Keep tool names listed at the bottom as reference for the agent itself.
  - **Verification:** files use natural conversational language in the human-facing instructions; reviewer reads one example and can immediately use it.

## Wave 2: Setup Friction Reduction

- [x] **Step 2.1: `notch onboard --mcp claude-desktop` mutates the Claude Desktop config**
  - **Files:**
    - `src/cli/mcp-config-claude-desktop.ts` - NEW
    - `src/cli/commands/onboard.ts` - MODIFIED
    - `tests/cli/onboard-mcp-claude-desktop.test.ts` - NEW
  - **Implementation:** locate the platform-specific Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS; `%APPDATA%\Claude\claude_desktop_config.json` on Windows). Read existing JSON. Preserve other `mcpServers` entries. Add or update the `3notch` entry pointing at the current repo's `.notch/`. Prompt for confirmation before writing. Write a `.bak` of the original alongside.
  - **Config-home injection:** accept a `NOTCH_CLAUDE_DESKTOP_CONFIG_HOME` env var override so tests don't touch the real config.
  - **Fallback:** if the config file doesn't exist, create the directory and write a fresh file. If the platform doesn't have Claude Desktop, print instructions instead.
  - **Verification:** `npm test -- onboard-mcp-claude-desktop`; injected temp config gets a `3notch` entry pointing at the test project's `.notch/`; existing entries preserved; backup file written.

- [x] **Step 2.2: `notch onboard --mcp claude-code` writes `.mcp.json` to the project root**
  - **Files:**
    - `src/cli/mcp-config-claude-code.ts` - NEW
    - `src/cli/commands/onboard.ts` - MODIFIED
    - `tests/cli/onboard-mcp-claude-code.test.ts` - NEW
  - **Implementation:** write or update `.mcp.json` at the project root (next to `.notch/`, not inside it). Same merge-preserve semantics as 2.1. Print a hint that the user can opt out by deleting the file.
  - **Verification:** `npm test -- onboard-mcp-claude-code`; `.mcp.json` exists at project root with `3notch` server entry; existing entries preserved.

- [x] **Step 2.3: Document same-store cross-tool pattern as the default recommended setup**
  - **Files:**
    - `docs/cross-tool-handoff.md` - MODIFIED
    - `README.md` - MODIFIED
  - **Implementation:** explain that for a single project worked across Claude Code and Claude Desktop, pointing both MCP servers at the same `.notch/` path removes the import step entirely. The packet appears in `outbox/`; both agents see it from their own client. No copy-paste, no transfer command. Update the README quickstart to lead with this pattern.
  - **Verification:** reader can follow the doc and have both tools sharing a store in under 5 minutes.

- [x] **Step 2.4: Out-of-scope clients print improved instructions, not "configure it yourself"**
  - **Files:**
    - `src/cli/mcp-instructions.ts` - MODIFIED
    - `tests/cli/onboard.test.ts` - MODIFIED
  - **Implementation:** for `codex`, `cursor`, and `chatgpt-desktop`, the printed instructions include the exact JSON/TOML snippet to paste, the correct config file path per OS, and the `notch mcp serve --store <path>` invocation. No mutation; just better instructions.
  - **Verification:** instructions are concrete enough that a user can copy-paste-edit and have it working.

## Wave 3: Concrete Security Story

- [x] **Step 3.1: `notch scan <file-or-stdin>` standalone secret scanner**
  - **Files:**
    - `src/cli/commands/scan.ts` - NEW
    - `src/cli/program.ts` - MODIFIED
    - `tests/cli/scan.test.ts` - NEW
  - **Implementation:** runs the existing `scanForSecrets` against arbitrary text. Accepts a file path argument, or `-` / stdin. Returns exit code 0 if clean, 1 if findings, with `--json` reporting the findings list. No writes, no audit log entry — pure pre-flight check.
  - **Use cases:** user can pipe clipboard content through it before pasting into a chat; CI/script can scan content before sending; broader utility than 3Notch's own use cases.
  - **Verification:** `npm test -- scan`; clean text exits 0; text with API key exits 1; JSON output includes finding details.

- [x] **Step 3.2: `notch packet preview <id>` (formal "agent-view" command)**
  - **Files:**
    - `src/cli/commands/packet.ts` - MODIFIED
    - `tests/cli/packet.test.ts` - MODIFIED
  - **Implementation:** add `preview` as a packet subcommand. Functionally similar to `show` but with a header that explicitly frames the output as "what an agent reading this packet will see." Includes a warning if the packet contains content the secret scanner would flag on re-scan (catches drift if the scanner was upgraded after the packet was written).
  - **Verification:** `notch packet preview <id>` output contains the "agent will see this" framing; if the packet content matches a current redaction pattern, the output includes a `⚠ scanner warning` line.

- [x] **Step 3.3: Secret-scanner UX for benign-prose blocks**
  - **Files:**
    - `src/core/secret-scan-service.ts` - MODIFIED
    - `tests/unit/secret-scan-service.test.ts` - MODIFIED
  - **Implementation:** when the scanner blocks because of a pattern hit on documentation prose (no actual high-entropy follow-up, just the trigger word in a sentence), include context in the error: which file/field hit, the line/snippet, and a "rephrase suggestion" sentence. Don't relax the block — improve the explanation.
  - **Verification:** blocked write reports include the offending excerpt and a recovery hint.

- [x] **Step 3.4: `docs/security-story.md` doc page**
  - **Files:**
    - `docs/security-story.md` - NEW
    - `README.md` - MODIFIED (add link)
  - **Implementation:** the explicit pitch — curate, scan, audit, review. Honest about where the framing is strong (pre-write scanning, source-link not content default, audit trail, reviewable artifacts) and where it overreaches (the agent still sends content to the LLM provider when it reads the packet; V1 has no encryption at rest). Reference `notch scan` and `notch packet preview` as the concrete tools.
  - **Verification:** doc exists; README links it; content matches the V1.1 review conversation.

## Wave 4: Close The Loop

- [x] **Step 4.1: Update CHANGELOG.md**
  - **Files:**
    - `CHANGELOG.md` - MODIFIED
  - **Implementation:** add a `0.2.0` section (or whatever versioning V1 shipped as) listing the V1.1 additions: agent prompt pack, MCP auto-config for two clients, standalone scanner, packet preview, security story doc.

- [x] **Step 4.2: Update README quickstart for the agent-driven flow**
  - **Files:**
    - `README.md` - MODIFIED
  - **Implementation:** the new quickstart shows the conversational pattern as the primary way to use 3Notch. CLI commands are listed as the underlying mechanism, not the daily interface.

- [x] **Step 4.3: Bump package version, run full verification**
  - **Files:**
    - `package.json` - MODIFIED (version bump)
  - **Verification:** `npm run lint && npm run type-check && npm run build && npm test && npm run test:e2e && node dist/cli/index.js --help && node dist/cli/index.js --version && node dist/cli/index.js scan README.md && node dist/cli/index.js prompt --client claude-code`.

## Final: E2E Smoke For The New Workflow

- [x] **Step 5.1: Agent-driven cross-tool smoke test**
  - **Files:**
    - `tests/e2e/agent-driven-handoff-smoke.test.ts` - NEW
    - `tests/e2e/onboard-mcp-config-smoke.test.ts` - NEW
  - **Implementation:**
    - Spin up a temp project, run `notch onboard --yes --mcp claude-code` with an injected config home, assert `.mcp.json` was written with the right server entry.
    - Spin up an MCP harness on the test store. Simulate an agent calling `create_packet` based on a packet-create request that includes only conversational summary + source links (no raw paste). Verify the packet lands in `outbox/`.
    - Open a second MCP harness on the SAME store (simulating Claude Desktop pointed at the same path). Call `list_packets({ direction: 'outbox' })`. Confirm the just-created packet is visible. Call `get_packet`. Confirm content matches.
    - Assert no copy-paste step is required between the two harnesses.
  - **Verification:** `npm run test:e2e -- agent-driven-handoff-smoke onboard-mcp-config-smoke`.

## Out Of V1.1 Scope (deferred to V1.2 or later)

- Hub `.notch/` aggregator for Claude Desktop seeing multiple projects.
- `notch audit` human-readable report.
- `notch packet update`, `notch packet diff`.
- Per-packet redaction rules.
- Hosted sync, browser UI, team workspaces (these stay V2 / commercial-tier).
- DXT packaging for Claude Desktop.
- Encryption at rest for private packets.
- Any new MCP tools.

## Forward-Compatibility Commitments

These are not V1.1 features. They are contracts for how V1+ behavior maps to future versions, so external tooling and agent prompts built today don't need to change when V2 ships.

- **`sensitivity: private` will gate V2 at-rest encryption.** The field is already in the V1 schema. V2 will add app-level encryption (separate from OS disk encryption) for records carrying `sensitivity: private`. Tools and agent prompts built today should treat the field as authoritative for "this content deserves stronger protection." No new flag, new field, or new MCP tool will be introduced for this — the encryption decision will key off the existing field.

If a V1.2 plan is needed later, it lands in `docs/active-plans/v1.2/` and this V1.1 plan moves to `docs/archived-plans/v1.1/`.

## Implementation Log

Append progress entries to `docs/active-plans/v1.1/v1.1-implementation-log.md` after each coherent slice or wave.
