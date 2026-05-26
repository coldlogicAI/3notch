# Implementation Plan: 3Notch V2

## Status

V1 and V1.1 are shipped. The V1 technical spec (`docs/archived-plans/v1/3notch-v1-technical-spec.md`) remains authoritative for architecture, data model, store layout, security boundaries, and error codes. V2 adds new optional schema fields, three new CLI verbs, one new derived index artifact, three new MCP tools, one new bridge prompt, and a stdin path for `notch packet import`. It does not change existing record formats, MCP tool signatures, or audit log shape.

V2 absorbs the original 2026-05-23 V2 decision (async threaded replies on records). That decision is now scoped to **schema primitives only**; the threaded-reply UX layer (surfacing, resolution flows, digests) is explicitly deferred. The reframe is recorded in the user-level memory file `project_3notch_v2_scope.md`.

## Scope (six themes, nothing else)

1. **Wiki-use-case primitives.** Karpathy-style LLM wiki enabled as a use case, not built as a feature. Adds `supersedes` packet field and `.notch/index/relationships.json` — a deterministic edge index over explicit metadata. The inbox becomes queryable as a structured corpus; any agent can compile a wiki on top.
2. **Self-addressed permanent capture.** `notch mark` for solo-use packets — no recipient required. Lowers the adoption bar; today the value prop requires a destination.
3. **Reply schema primitives.** `replyTo`, `replyType` enum, reply `status`, plus `notch reply` CLI verb and matching MCP tool. Authored edges only — no surfacing UX, no resolution prompting, no digests.
4. **Web-chat intake bridge.** `notch prompt --client claude-chat` (naming TBD) template plus `notch packet import -` stdin so paste-from-clipboard ingests. Closes the highest-friction crossing — web/desktop chat has no MCP path into a project today, so the human is the bus.
5. **Corpus integrity check.** `notch check` — deterministic structural integrity rules over the relationships index. Catches broken `supersedes`/`replyTo` references, cycles, self-references, and conflicting supersedes claims. Completes the Karpathy IDE-and-codebase picture: `relationships.json` is the index, `notch check` is the integrity verifier. (Verb is deliberately `check`, not `lint` — see Steinberger Filter for the IP-hygiene rule.)
6. **Inbox immutability guarantee.** Documented + enforced in `transfer-service.ts`. Received packets are ground truth.

## The Steinberger Filter

Every item below passed this test: *would Peter Steinberger ship this, or would he say "remove it, it pollutes context and the alternative is faster"?*

Items that did **not** pass and are explicitly **out of scope for V2**:

- **Agent UX for surfacing open replies on session load.** The schema primitive is in. The surfacing flow is speculative — no agent in real use has needed it yet. Defer until usage informs the prompt shape.
- **Resolution prompt flows, reply digests, reply notifications.** UX work that pre-designs patterns nobody has used.
- **Mobile/voice intake; Claude Code → web sharing; other surface bridges.** Real future work, but V2's bridge headline is the web-chat case because it's the demonstrated friction. Other surfaces wait for their own demonstration.
- **Auto-tagging at ingest, similarity-based threading, contradiction flagging.** Semantic derivation requires intelligence; intelligence belongs to the user's agent reading the inbox, not to 3Notch writing it. Deterministic *indexing* (mechanical edges from explicit fields) is in; semantic *compilation* is out.
- **Wiki UI, browse view, graph view.** The wiki is a use case the user's agent serves, not a 3Notch feature. Stay on the CLI side of that line.
- **Encryption at rest for private packets.** Forward-commit acknowledged in V1.1, deferred again. OS-level disk encryption covers the V2 case.
- **Resolution semantics for replies.** Authoring a reply is in scope. Deciding what counts as resolved is UX layer — V2.1+.
- **A `wiki:` or `compile:` command surface.** No tooling that implies 3Notch builds the wiki.
- **New record types.** Replies are packets with `replyTo` set. Marks are packets with no recipient. No new top-level types.
- **The verb `lint` is reserved (held out of 3Notch OSS, permanently).** Structural integrity surfaces use `check`. Future integrity work uses `check`, `verify`, `validate`, or similar — never `lint`. This is an IP-hygiene rule to preserve the iPSM patent-claim boundary; honor it when extending 3Notch in any future version.
- **LLM-based or schema-driven semantic lint.** The `notch check` rules are mechanical metadata checks over explicit fields. Any rule requiring an LLM, an authoritative external domain schema, or semantic content comparison is out — that pattern is iPSM territory.
- **Cross-store / cross-user pattern aggregation.** All forms. Even primitive aggregation over multiple `.notch/` stores stays out of 3Notch OSS. If team workspaces ever ship, they live on the commercial/hosted layer where licensing is selective.

The principle: **primitives in; the UX layer earns its way in by being needed.**

## Assumptions

- V1 + V1.1 implementations are complete and tested. The V1 architecture (Markdown+YAML records, local file store, Ajv schema validation, file-scan index, stdio MCP, audit log, path safety, secret scan) does not change.
- V2 introduces:
  - 4 new optional packet fields (`supersedes`, `replyTo`, `replyType`, reply `status`).
  - 3 new CLI commands (`notch mark`, `notch reply`, `notch check`).
  - 1 new derived index file (`.notch/index/relationships.json`).
  - 1 new prompt template (`notch prompt --client <web-chat-id>`).
  - 1 stdin path for an existing command (`notch packet import -`).
  - 3 new MCP tools (`create_mark`, `create_reply`, `check_store`) — first two mirror existing `create_packet` shape; `check_store` returns structured findings.
- The audit log and path safety semantics from V1 cover the new commands automatically.
- The V1.1 secret scanner and packet-preview tooling cover the new write paths without modification.

## Wave 1: Wiki-Use-Case Primitives (the substrate piece)

Lands the deterministic indexing that makes the inbox queryable as a structured corpus. This is the foundation Waves 2–5 build on top of.

- [x] **Step 1.1: Add `supersedes` field to packet schema**
  - **Files:**
    - `src/schemas/packet.schema.json` — MODIFIED
    - `src/types/records.ts` — MODIFIED
    - `src/core/record-parser.ts` — MODIFIED (validate referenced ID exists when packet is imported into a store with the referenced packet)
    - `tests/unit/packet-schema.test.ts` — MODIFIED
  - **Implementation:** optional string field; matches existing record-ID format. When a packet declares `supersedes: <id>`, the audit log entry for the write includes the superseded ID. Validation: schema-level format check; existence check only on import into a store (not on create — the predecessor may live in another store).
  - **Verification:** schema rejects malformed IDs; audit log records `supersedes` on create/import.

- [x] **Step 1.2: `.notch/index/relationships.json` derived index**
  - **Files:**
    - `src/core/relationships-service.ts` — NEW
    - `src/core/index-service.ts` — MODIFIED (call relationships-service after every index rebuild)
    - `src/core/store-layout.ts` — MODIFIED (add `relationships` path)
    - `tests/unit/relationships-service.test.ts` — NEW
  - **Implementation:** after every record write, scan all records in the store and emit an edge list to `.notch/index/relationships.json`:
    - `supersedes` — directed edge A ← B when B sets `supersedes: A`.
    - `co-tagged` — undirected edge when two packets share ≥2 tags.
    - `co-recipient` — directed edge for sender+recipient pairs (clusters packets in a thread).
    - `co-source-link` — undirected edge when two packets reference the same file path or URL.
  - **Output shape:** `{ schemaVersion, generatedAt, edges: [{ type, from, to, metadata? }] }`. Sorted deterministically for diff-friendliness.
  - **Performance budget:** for a store with 1,000 records the full rebuild should complete in under 1 second. If the budget breaks, switch to incremental updates in a follow-up; do not pre-optimize.
  - **Verification:** unit tests cover each edge type; rebuild is idempotent (running it twice produces byte-identical output); fixture with 3-packet supersedes chain produces the expected graph.

- [x] **Step 1.3: Document and enforce inbox immutability**
  - **Files:**
    - `src/core/transfer-service.ts` — MODIFIED
    - `docs/cross-tool-handoff.md` — MODIFIED
    - `docs/security-story.md` — MODIFIED (add "received packets are ground truth" section)
    - `tests/unit/transfer-service.test.ts` — MODIFIED
  - **Implementation:** when `importPacketFile` lands at a destination path that already exists with a different content hash, fail-loud with `NOTCH_RECORD_IMMUTABLE` rather than overwrite. (Current `writeRecordWithCollisionHandling` produces a new filename; this assertion catches direct-overwrite attempts from future code paths.) Doc page declares the immutability contract.
  - **Verification:** unit test attempts overwrite, asserts error; doc clearly states the guarantee.

## Wave 2: Self-Addressed Permanent Capture (`notch mark`)

Lowers adoption to "useful from day one even if you never send a packet to anyone."

- [x] **Step 2.1: `notch mark` CLI command**
  - **Files:**
    - `src/cli/commands/mark.ts` — NEW
    - `src/cli/program.ts` — MODIFIED
    - `tests/cli/mark.test.ts` — NEW
  - **Implementation:** thin wrapper over `createPacket` with `purpose: 'seed'`, `sensitivity: 'private'`, recipient check skipped (self-addressed). Lands in `.notch/private/inbox/` directly — no outbox step. Required flag: `--summary`. Optional: `--title`, `--supersedes`, `--file`, `--tags`. If `--title` is omitted, derive from the first non-empty line of `--summary` (truncated to 80 chars).
  - **Verification:** `notch mark --summary "Decided to use cookies for auth"` writes a record under `private/inbox/`; audit log entry created; `--supersedes <id>` records the edge.

- [x] **Step 2.2: `create_mark` MCP tool**
  - **Files:**
    - `src/mcp/tools.ts` (or wherever tool registration lives) — MODIFIED
    - `src/schemas/mcp-tools.schema.json` — MODIFIED
    - `tests/mcp/create-mark.test.ts` — NEW
  - **Implementation:** mirrors CLI shape. Same defaults. Same write path.
  - **Verification:** MCP tool list includes `create_mark`; integration test creates a mark via MCP.

- [x] **Step 2.3: Update agent prompt packs to mention `mark` / `create_mark`**
  - **Files:**
    - `src/cli/prompts/claude-code.ts` — MODIFIED
    - `src/cli/prompts/claude-desktop.ts` — MODIFIED
    - `src/cli/prompts/codex.ts` — MODIFIED
    - `src/cli/prompts/cursor.ts` — MODIFIED
  - **Implementation:** add one sentence per prompt: "When the user says they want to remember something for themselves (a decision, a finding, a thought), use `create_mark`."
  - **Verification:** `npm test -- prompt` snapshot updates reviewed and intentional.

## Wave 3: Reply Schema Primitives

Schema-and-CLI work that lets agents (and the user) author typed follow-ups against any record. No surfacing UX — that's deferred.

- [x] **Step 3.1: Add `replyTo`, `replyType`, reply `status` to packet schema**
  - **Files:**
    - `src/schemas/packet.schema.json` — MODIFIED
    - `src/types/records.ts` — MODIFIED
    - `src/core/record-parser.ts` — MODIFIED (existence check on import; schema validation on create)
    - `tests/unit/packet-schema.test.ts` — MODIFIED
  - **Implementation:** all optional.
    - `replyTo: <record-id>` — must point at any record in the same store on import.
    - `replyType: "question" | "clarification" | "counter-decision" | "objection" | "confirmation"` — only valid when `replyTo` is set.
    - `status: "open" | "resolved" | "dismissed"` — defaults to `"open"` when `replyTo` is set; not allowed when `replyTo` is absent.
  - **Verification:** schema rejects `replyType` without `replyTo`; rejects `status` without `replyTo`; accepts valid reply records.

- [x] **Step 3.2: `notch reply` CLI command**
  - **Files:**
    - `src/cli/commands/reply.ts` — NEW
    - `src/cli/program.ts` — MODIFIED
    - `tests/cli/reply.test.ts` — NEW
  - **Implementation:** `notch reply <parent-id> --type <type> --summary "..."`. Optional: `--title`, `--to-agent` / `--to-person` / `--to-repo` (defaults to inheriting the parent's recipient when applicable). Sensitivity inherits from parent unless `--private` is passed. Direction: if parent is in outbox, the reply lands in outbox; if in inbox, lands in private/inbox (you can't author a reply *into* someone else's inbox).
  - **Verification:** `notch reply <id> --type question --summary "..."` writes a packet with `replyTo`, `replyType`, `status: open`; relationships.json gains the edge after rebuild.

- [x] **Step 3.3: `create_reply` MCP tool**
  - **Files:**
    - `src/mcp/tools.ts` — MODIFIED
    - `src/schemas/mcp-tools.schema.json` — MODIFIED
    - `tests/mcp/create-reply.test.ts` — NEW
  - **Implementation:** mirrors CLI shape.
  - **Verification:** tool surfaces in MCP server; integration test creates a reply via MCP.

- [x] **Step 3.4: `replyTo` edge in relationships.json**
  - **Files:**
    - `src/core/relationships-service.ts` — MODIFIED
    - `tests/unit/relationships-service.test.ts` — MODIFIED
  - **Implementation:** add `replyTo` edge type to the index builder (directed A ← B when B sets `replyTo: A`). The index does NOT compute "open replies" as a derived view in V2 — that view belongs to the consumer (the agent reading the index).
  - **Verification:** reply chain shows up as edges; multiple replies on the same parent all appear.

## Wave 4: Web-Chat Intake Bridge (the lived-pain headline)

Collapses the user-as-bus workflow into a clean import. This is the wave that pays back the most-felt friction.

- [x] **Step 4.1: `notch prompt --client <web-chat-id>` template**
  - **Files:**
    - `src/cli/prompts/claude-chat.ts` — NEW *(naming: `claude-chat` vs `claude-web` — decide in implementation; whichever doesn't collide with existing `claude-desktop`)*
    - `src/cli/commands/prompt.ts` — MODIFIED
    - `tests/cli/prompt.test.ts` — MODIFIED
  - **Implementation:** outputs a paste-ready instruction block to drop into a Claude.ai web/desktop conversation. The block teaches the conversation to: (a) keep track of the user's project context; (b) on request, emit a self-contained packet block in 3Notch's Markdown+YAML format with `purpose: seed` (the conversation is feeding the user's own inbox); (c) end with a single command the user runs to ingest.
  - **Output:** plain text by default, JSON with `--json` for scripted onboarding.
  - **Verification:** output contains the YAML frontmatter spec, an example packet, the import command (`pbpaste | notch packet import -` macOS, `xclip` Linux equivalents, `Get-Clipboard | notch packet import -` PowerShell), and a one-line "tell the chat to give you a packet when you're done" hint.

- [x] **Step 4.2: `notch packet import -` stdin path**
  - **Files:**
    - `src/cli/commands/packet.ts` — MODIFIED (accept `-` as the file argument)
    - `src/core/transfer-service.ts` — MODIFIED (factor file-read so it can take a string)
    - `tests/cli/packet-import.test.ts` — MODIFIED
  - **Implementation:** when the file argument is `-`, read stdin until EOF and route through the existing `importPacketFile` validation + write path. Same audit log, same secret scan, same review status defaults.
  - **Verification:** `cat fixture.md | notch packet import -` lands the packet; secret-scan trips correctly on poisoned stdin; audit log records the import.

- [x] **Step 4.3: Document the web-chat bridge**
  - **Files:**
    - `docs/prompts/web-chat-to-project.md` — NEW
    - `docs/cross-tool-handoff.md` — MODIFIED (link to the new prompt)
    - `README.md` — MODIFIED (lead the quickstart with this as one of the canonical paths)
  - **Implementation:** end-to-end walkthrough. "In Claude.ai, paste this prompt. Talk normally. When you're done, ask for a packet. Copy. In your terminal: `pbpaste | notch packet import -`." Include the platform-equivalent paste-pipe commands.
  - **Verification:** a reader who follows the doc can complete one end-to-end ingest in under 5 minutes.

## Wave 5: Corpus Integrity Check (`notch check`)

The Karpathy IDE-and-codebase analogy completes here: `relationships.json` is the index; `notch check` is the integrity verifier. Five deterministic structural rules over the corpus + relationships index. No semantic reasoning, no LLM. The verb is deliberately `check`, not `lint` — the word "lint" stays out of 3Notch OSS, permanently, to preserve iPSM patent-claim hygiene.

- [x] **Step 5.1: `notch check` CLI command and core rules**
  - **Files:**
    - `src/cli/commands/check.ts` — NEW
    - `src/core/check-service.ts` — NEW
    - `src/cli/program.ts` — MODIFIED
    - `tests/cli/check.test.ts` — NEW
    - `tests/unit/check-service.test.ts` — NEW
  - **Implementation:** read all records + `relationships.json`. Run each rule. Emit findings sorted by severity then packet ID. Plain text by default; `--json` for machine output. Exit 0 if no errors, 1 otherwise. Honors `--quiet` to suppress info-level findings.
  - **Initial rules (V2):**
    - `CHECK_SUPERSEDES_BROKEN` (error): packet's `supersedes` field points at a record ID that does not exist in this store.
    - `CHECK_REPLYTO_BROKEN` (error): packet's `replyTo` field points at a record ID that does not exist in this store.
    - `CHECK_SUPERSEDES_CYCLE` (error): a `supersedes` chain contains a cycle.
    - `CHECK_SELF_REFERENCE` (error): packet's `supersedes` or `replyTo` points at itself.
    - `CHECK_SUPERSEDES_FORK` (warn): two or more packets claim to supersede the same parent — likely a conflict for the user/agent to resolve.
  - **Finding shape:** `{ rule, severity, packetId, message, recovery }`. Recovery hints are short imperative sentences.
  - **Verification:** fixture stores covering each rule produce expected findings; clean store produces zero findings; rule output is deterministic across runs.

- [x] **Step 5.2: `check_store` MCP tool**
  - **Files:**
    - `src/mcp/tools.ts` — MODIFIED
    - `src/schemas/mcp-tools.schema.json` — MODIFIED
    - `tests/mcp/check-store.test.ts` — NEW
  - **Implementation:** returns the same finding shape as `notch check --json`. Lets an agent inspect corpus health on session start or after big imports.
  - **Verification:** tool surfaces in MCP server; integration test returns findings in machine-readable form.

- [x] **Step 5.3: Surface check headline in `notch doctor`**
  - **Files:**
    - `src/cli/commands/doctor.ts` — MODIFIED
    - `tests/cli/doctor.test.ts` — MODIFIED
  - **Implementation:** doctor calls the check-service and surfaces a one-line summary (e.g., `3notch check: 0 errors, 2 warnings — run "notch check" for details`). Doctor stays store-config-focused; check stays corpus-content-focused. Doctor's overall exit code is unaffected by check findings (doctor is for env health; check is for corpus health).
  - **Verification:** doctor output gains the check summary line; standalone `notch check` output is unchanged.

## Wave 6: Close The Loop

- [x] **Step 6.1: Update CHANGELOG.md** — `0.3.0` section listing: `notch mark`, `notch reply`, `notch check`, `supersedes`, `replyTo`/`replyType`/`status`, `relationships.json` derived index, web-chat prompt template, `notch packet import -` stdin path, immutability guarantee, doctor check summary.

- [x] **Step 6.2: Update README** — frame 3Notch with the user-as-bus narrative ("you're already passing context by hand between AI surfaces — 3Notch is what you wish you'd had"). Show three canonical paths in the quickstart: (a) same-store cross-tool (carried from V1.1), (b) cross-repo handoff packet, (c) web-chat-to-project bridge. Mention `notch mark` as the solo-use entry point and `notch check` as the corpus integrity verifier.

- [x] **Step 6.3: Bump package version and run full verification** — lint, type-check, build, test, e2e, plus CLI smokes: `--help`, `--version`, `mark --summary`, `reply <id> --type question --summary`, `packet import -`, `prompt --client claude-chat`, `check`, `check --json`.

## Final: E2E Smoke For The New Workflows

- [x] **Step 7.1: Wiki-use-case smoke** — create three packets where C `supersedes` B `supersedes` A. Assert `relationships.json` contains the chain. Assert a fixture-agent script reading the inbox can walk the chain from A to C and back.

- [x] **Step 7.2: Reply-primitive smoke** — create a packet, `notch reply <id> --type question --summary "..."`, assert the reply lands with `replyTo`, `replyType: question`, `status: open`. Author a second reply with `--type clarification` whose summary "answers" the first. Assert `relationships.json` shows both edges.

- [x] **Step 7.3: Web-chat bridge smoke** — fixture file mimicking the output of `notch prompt --client claude-chat` consumed by Claude.ai. Pipe through `notch packet import -`. Assert the packet lands in private/inbox with audit log entry. Confirm secret scan runs against stdin content.

- [x] **Step 7.4: Mark smoke** — `notch mark --summary "Decided cookies over JWT" --tags "auth"` lands in private/inbox; `notch mark --supersedes <prev-id>` records the edge in `relationships.json`.

- [x] **Step 7.5: Corpus check smoke** — seed a store with packets exercising each rule (broken supersedes, broken replyTo, cycle, self-reference, fork). Run `notch check`. Assert exit code 1; assert each rule fires exactly once with the expected severity; assert `--json` output matches the documented finding shape; assert a clean store exits 0 with no findings.

## Out Of V2 Scope (deferred to V2.1 or later)

- Agent UX for surfacing open replies on session load.
- Resolution prompt flows; reply digests; notifications.
- Mobile/voice intake; Claude Code → web sharing; other surface bridges.
- Auto-tagging at ingest, similarity-based threading, contradiction flagging — any semantic derivation.
- Additional check rules (stale open reply, broken source-link, tag drift, orphan detection) — wait for real-usage demand before adding.
- Wiki UI / browse / graph view.
- Encryption at rest for private packets (forward-commit from V1.1, carried).
- Reply resolution semantics (when does a `status: open` reply flip to `resolved`?).
- Hub `.notch/` aggregator for multi-project Claude Desktop (carried from V1.1 deferral).
- DXT packaging for Claude Desktop (carried).

## Forward-Compatibility Commitments

These are not V2 features. They are contracts so external tooling and agent prompts built against V2 don't need to change when later versions ship.

- **`sensitivity: private` continues to gate at-rest encryption.** (Carried from V1.1.) When encryption lands, it keys off the existing field. No new flag.
- **`.notch/index/relationships.json` is a derived artifact.** External tooling MAY read it; it MUST NOT be written to. Source of truth is always the record files. The schema includes a `schemaVersion` and a `generatedAt` so consumers can detect staleness.
- **`replyTo` and `supersedes` are append-only edges.** Once authored on a record, removing them requires authoring a new record. V2 does not define a retraction pattern; one will be designed in a later version with at least 6 months' notice.
- **Reply `status` is authored, never auto-flipped by 3Notch core.** Agents and tools may set/update it by authoring records; the resolution semantics layer (which agent decides when to flip status) is out of V2 scope.
- **No new top-level record types in V2.** Marks are packets. Replies are packets. The packet schema remains the sole "thing flowing through the system" type.
- **The verb `lint` is reserved and held out of 3Notch OSS in perpetuity.** Structural integrity surfaces use `check`. Future integrity work uses `check`, `verify`, `validate`, or similar — never `lint`. IP-hygiene rule: the iPSM provisional claims LLM-based lint against an authoritative domain schema as an inventive enhancement to the general LLM-wiki pattern; 3Notch OSS deliberately keeps that name space clear.
- **`notch check` is deterministic and structural only.** Rules operate over explicit metadata fields. Adding LLM-based or semantic check rules to 3Notch is not a path; if richer integrity evaluation is ever wanted in a 3Notch product, it lives on a commercial/hosted tier under the iPSM patent license, not in OSS.

If a V2.1 plan is needed later, it lands in `docs/active-plans/v2.1/` and this V2 plan moves to `docs/archived-plans/v2/`.

## Implementation Log

Append progress entries to `docs/active-plans/v2/v2-implementation-log.md` after each coherent slice or wave.
