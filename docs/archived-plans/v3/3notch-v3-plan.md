# Implementation Plan: 3Notch V3

## Status

V1, V1.1, and V2 are shipped. The V1 technical spec (`docs/archived-plans/v1/3notch-v1-technical-spec.md`) remains authoritative for architecture, data model, store layout, security boundaries, and error codes. The V2 plan (`docs/archived-plans/v2/3notch-v2-plan.md`) is the authoritative substrate spec for `supersedes`, `replyTo`/`replyType`/`status`, `mark`, `check`, `relationships.json`, inbox immutability, and the audit log shape.

V3 builds on the V2 substrate. It does **not** rewrite it. V3 closes the artifact-envelope gap so the lived headline case (Claude Desktop → Codex with a JPEG + HTML + intent) works end-to-end on one machine without copy-paste.

This plan is the implementation contract — implementers work from this document alone. Background reasoning, refused options, and the diagnostic that produced the V3 shape live in `docs/archived-plans/v3/v3-memo.md` for human product decisions (e.g., V4 scoping); the memo is not required reading for executing V3.

## Scope (seven themes, nothing else)

1. **Folder-canonical packet layout.** Each packet is a directory on disk. V2-style single-file `.md` packets remain valid as the degenerate case (no artifacts). Every packet read/write path is touched.
2. **Artifact bundling.** `--file` copies bytes into the bundle's `artifacts/` and records SHA-256. `--ref` preserves V2 pointer behavior for shared-workspace cases. `manifest.json` records hash + size per artifact.
3. **`nextSteps` schema field.** Optional free-text string at the top level of the packet schema. The receiving agent reads this to know what to do with the bundle.
4. **`packet pack` / `packet unpack` archive verbs.** `.notchpkt` = gzipped tar with deterministic ordering. Optional transport convenience; the folder is canonical.
5. **Scanner extension over artifact bytes.** Text-like artifacts (extension allowlist) are full-scanned before write; binaries are skipped with a one-line audit-log entry.
6. **Size caps.** 50MB per artifact, 200MB per packet. Soft warn at 80%; hard reject at 100%.
7. **Schema version bump to `0.4.0`.** Additive fields are back-compat; the folder-canonical layout warrants a minor bump so consumers can branch on the version.

## The Steinberger Filter

Every item below passed the same test the V2 plan applied: *would Peter Steinberger ship this, or would he say "remove it, it pollutes context and the alternative is faster"?* V3 narrows the filter further: *does this make the brand-handoff lived case work end-to-end? If not, defer.*

Items that did **not** pass and are explicitly **out of scope for V3**:

- **Transport, send verbs, hosted relay.** The user's existing kit (scp, rsync, Tailscale, Syncthing, iCloud, git) already moves files between machines. 3Notch will not re-implement OS plumbing or take on identity/auth/uptime. `notch packet pack` produces a file the user moves via whatever channel they already use.
- **Identity, auth, signing.** Hashing alone (SHA-256 in the manifest) gives "this is the same bundle that left the sender." Signing requires key management 3Notch will not own in V3.
- **Receiver-side intent verbs / structured action enums.** `nextSteps` is free text. No DSL. No enum. The receiving agent interprets.
- **Connector / remote MCP for web-chat ingest.** The structurally honest replacement for the clipboard fallback is real, but it lives in "Where We Want Help" as a community-contribution target or V3.1. Not V3 core.
- **Browse / wiki / graph UI over `relationships.json` or the inbox.** Contributor ecosystem territory. V3 does not ship surfaces over the substrate.
- **Reply-surfacing UX, resolution semantics, digests, notifications.** Carried from V2's deferral list. Substrate is in; UX waits for demonstrated demand.
- **Encryption at rest for `.notch/private/`.** Carried from V1.1 and V2 deferrals. OS-level disk encryption still covers the V3 case.
- **Cross-store / cross-user aggregation in any form.** Stays out of 3Notch OSS, per V2.
- **Lint verb.** Held out permanently per the V2 IP-hygiene commitment. Structural surfaces use `check`.
- **New top-level record types.** Packets carry artifacts via the new `artifacts[]` field. No new record type is introduced.
- **Mutable packets.** Same as V2: once a packet exists in inbox or outbox, the way to change it is to author a successor with `supersedes`. Folder-canonical does not loosen this — the folder is the immutable unit, manifest hashes lock the contents.

The principle inherits V2's: **primitives in; the UX layer earns its way in by being needed.** V3 adds one primitive — the envelope — and resists adding anything that wraps it in convenience verbs before real usage demonstrates the wrapper.

## Assumptions

- V1 + V1.1 + V2 implementations are complete and tested.
- The V2 packet schema, MCP tool signatures, audit log shape, and store layout (`outbox/`, `inbox/`, `private/`, `index/`, `logs/`) are stable contracts. V3 adds to them and does not break them.
- The V1.1 secret scanner (`secret-scan-service.ts`) and packet preview tooling cover the new write paths with the artifact-byte extension documented in Wave 5.
- The V2 `relationships.json` derived index continues to work unchanged. Artifacts are not edges.
- V3 introduces:
  - 2 new optional packet schema fields (`nextSteps`, `artifacts[]`).
  - 0 new top-level record types.
  - 2 new CLI verbs (`notch packet pack`, `notch packet unpack`).
  - 1 new CLI flag pair (`--file` semantics change to copy bytes by default; new `--ref` for V2 pointer behavior).
  - 1 new CLI flag (`--next-steps`).
  - 1 new derived per-packet artifact (`manifest.json` inside each packet folder).
  - 1 new archive format (`.notchpkt`).
  - 2 new MCP tool params on existing tools (`nextSteps`, `artifacts` on `create_packet`); no new MCP tools.
  - 1 schema-version bump (`0.4.0`).

## Wave 1: Folder-Canonical Packet Layout

Lands the structural change every other wave builds on. After this wave, packets read and write as folders; single-file V2 packets remain valid as the degenerate case (folder containing only `packet.md`, no `artifacts/`, no `manifest.json`).

- [ ] **Step 1.1: Folder-canonical store layout**
  - **Files:**
    - `src/core/store-layout.ts` — MODIFIED (add helpers for packet-folder paths; a packet on disk is `outbox/<slug>/packet.md` or, in the degenerate case, `outbox/<slug>.md`)
    - `src/core/store-service.ts` — MODIFIED (`writeRecordWithCollisionHandling` accepts a directory-bundle form)
    - `tests/unit/store-layout.test.ts` — MODIFIED
  - **Implementation:** add `packetFolderPath(slug)` and `packetMarkdownPath(slug)` helpers. New packets created with artifacts write as folders; new packets without artifacts may write as folders (canonical) or as single files (degenerate-back-compat); reads tolerate both forms.
  - **Verification:** unit tests cover folder-form and single-file-form path resolution; collision handling extended to folder names.

- [ ] **Step 1.2: Packet read paths tolerate folder OR single-file form**
  - **Files:**
    - `src/core/packet-service.ts` — MODIFIED (`listPackets`, `getPacket`, `findRecordById`)
    - `src/core/store-service.ts` — MODIFIED (`scanMarkdownRecords` walks folder-form packets)
    - `tests/unit/packet-service.test.ts` — MODIFIED
  - **Implementation:** scanner recognizes `<slug>/packet.md` as a packet and treats the parent folder as the packet root. `getPacket` returns the packet root path (folder) plus the resolved `packet.md` path for code that needs the markdown directly.
  - **Verification:** fixtures with both forms in the same store are listed correctly; V2 single-file packets continue to load with no migration.

- [ ] **Step 1.3: Inbox immutability extends to the folder**
  - **Files:**
    - `src/core/transfer-service.ts` — MODIFIED (`importPacketFile` and new folder-import paths)
    - `docs/security-story.md` — MODIFIED (immutability section names the folder as the immutable unit)
    - `tests/unit/transfer-service.test.ts` — MODIFIED
  - **Implementation:** when a packet folder is imported, the receiving folder is sealed: any attempted overwrite of `packet.md`, `manifest.json`, or any file under `artifacts/` raises `NOTCH_RECORD_IMMUTABLE`. Authoring a successor requires `supersedes` plus a new folder.
  - **Verification:** unit tests attempt artifact overwrite, manifest overwrite, packet.md overwrite — all fail-loud.

- [ ] **Step 1.4: Preview / show render the folder contents**
  - **Files:**
    - `src/cli/commands/packet.ts` — MODIFIED (`packet preview`, `packet show`)
    - `tests/cli/packet-preview.test.ts` — MODIFIED
  - **Implementation:** preview output lists the markdown body, the `nextSteps` field if present, and an artifact table (`path`, `sha256` short, `bytes`). Single-file V2 packets render unchanged.
  - **Verification:** preview of a folder-form packet shows the artifact list; preview of a V2 single-file packet matches the V2 output snapshot.

## Wave 2: Artifact Bundling

The headline V3 feature. `--file` copies bytes by default; `--ref` preserves V2 pointer behavior. SHA-256 hash and byte size recorded in both `manifest.json` and the packet's frontmatter `artifacts[]` array.

- [ ] **Step 2.1: `artifacts[]` packet schema field**
  - **Files:**
    - `src/schemas/packet.schema.json` — MODIFIED
    - `src/schemas/shared.schema.json` — MODIFIED (add `artifactEntry` `$def`)
    - `src/types/records.ts` — MODIFIED (`PacketArtifact` type)
    - `tests/unit/packet-schema.test.ts` — MODIFIED
  - **Implementation:** optional array. Each entry: `{ path: string, sha256: string (64 hex), bytes: integer, purpose: "asset" | "source" | "reference" | "output" }`. `path` is relative to the packet folder root, must be under `artifacts/`. Schema rejects absolute paths, parent-relative paths, and any path component starting with `.`.
  - **Verification:** schema accepts well-formed entries; rejects path traversal, absolute paths, non-hex sha256, negative bytes, unknown purpose values.

- [ ] **Step 2.2: `--file` copies bytes by default**
  - **Files:**
    - `src/cli/commands/packet.ts` — MODIFIED (`packet create`)
    - `src/core/packet-service.ts` — MODIFIED (`createPacket` reads bytes for each `--file`, writes to bundle `artifacts/`, computes SHA-256 + byte size)
    - `src/core/artifact-service.ts` — NEW (shared logic: hash, size, path-safety, copy)
    - `tests/unit/artifact-service.test.ts` — NEW
    - `tests/cli/packet-create.test.ts` — MODIFIED
  - **Implementation:** for each `--file path`, resolve under `project.root` via existing `assertSafeRelativePath`. Read bytes. Compute SHA-256. Copy to `<packet-folder>/artifacts/<basename>` (collision-handled by suffix). Append `artifacts[]` entry. `purpose` defaults to `asset`; `--file path:source` lets the user override (`path:asset`, `path:source`, `path:reference`, `path:output`).
  - **Verification:** create packet with two `--file` args, assert both bytes land under `artifacts/`, hashes match, schema is valid.

- [ ] **Step 2.3: `--ref` preserves V2 pointer behavior**
  - **Files:**
    - `src/cli/commands/packet.ts` — MODIFIED
    - `src/core/packet-service.ts` — MODIFIED
    - `tests/cli/packet-create.test.ts` — MODIFIED
  - **Implementation:** `--ref path` adds a source link entry (V2 behavior) without copying bytes. Documented as the explicit opt-in for shared-workspace cases. Cannot point at a path under `.notch/` (protect the store).
  - **Verification:** `--ref` produces a packet with `includedSourceLinks` populated and `artifacts[]` empty.

- [ ] **Step 2.4: `manifest.json` written alongside `packet.md`**
  - **Files:**
    - `src/core/artifact-service.ts` — MODIFIED (write manifest)
    - `src/core/store-layout.ts` — MODIFIED (manifest path helper)
    - `tests/unit/artifact-service.test.ts` — MODIFIED
  - **Implementation:** when `artifacts[]` is non-empty, write `<packet-folder>/manifest.json`:
    ```json
    {
      "schemaVersion": "0.4.0",
      "packetId": "...",
      "generatedAt": "...",
      "artifacts": [
        { "path": "artifacts/mascot.jpg", "sha256": "...", "bytes": 84210 }
      ]
    }
    ```
    Sorted deterministically by `path` for diff-friendliness.
  - **Verification:** manifest matches frontmatter `artifacts[]`; byte-identical across repeated runs.

- [ ] **Step 2.5: Import verifies manifest hashes**
  - **Files:**
    - `src/core/transfer-service.ts` — MODIFIED (`importPacketFolder` — new path; existing `importPacketFile` still handles single-file V2 packets)
    - `src/core/artifact-service.ts` — MODIFIED (verify helper)
    - `tests/unit/transfer-service.test.ts` — MODIFIED
  - **Implementation:** on folder import, re-hash each file under `artifacts/`. Cross-check against `manifest.json` AND against frontmatter `artifacts[].sha256`. Mismatch raises `NOTCH_ARTIFACT_HASH_MISMATCH` with the offending path.
  - **Verification:** import a clean bundle (passes); import a bundle with a tampered artifact (fails); import a bundle where manifest and frontmatter disagree (fails).

- [ ] **Step 2.6: `create_packet` MCP tool accepts `artifacts`**
  - **Files:**
    - `src/mcp/tools.ts` — MODIFIED
    - `src/schemas/mcp-tools.schema.json` — MODIFIED
    - `tests/mcp/create-packet.test.ts` — MODIFIED
  - **Implementation:** `create_packet` MCP input gains an optional `files: string[]` (copy) and `refs: string[]` (reference). Same defaults as CLI. No new tool added — additive parameter only.
  - **Verification:** MCP integration test creates a packet with two files and asserts the bundle.

## Wave 3: `nextSteps` Schema Field

The smallest scope item. One optional field. Lets prompt packs read a known location instead of parsing Markdown headings out of `summary`.

- [ ] **Step 3.1: Schema + types**
  - **Files:**
    - `src/schemas/packet.schema.json` — MODIFIED
    - `src/types/records.ts` — MODIFIED
    - `tests/unit/packet-schema.test.ts` — MODIFIED
  - **Implementation:** optional top-level string. Min length 1. No max. Renders into `packet.md` body as `## Next Steps\n\n<nextSteps>` when present.
  - **Verification:** schema accepts; absent field still valid; empty string rejected.

- [ ] **Step 3.2: `--next-steps` CLI flag and MCP param**
  - **Files:**
    - `src/cli/commands/packet.ts` — MODIFIED
    - `src/core/packet-service.ts` — MODIFIED (`CreatePacketInput.nextSteps`)
    - `src/mcp/tools.ts` — MODIFIED
    - `src/schemas/mcp-tools.schema.json` — MODIFIED
    - `tests/cli/packet-create.test.ts` — MODIFIED
    - `tests/mcp/create-packet.test.ts` — MODIFIED
  - **Implementation:** `notch packet create --next-steps "..."`; MCP `create_packet` `{ nextSteps: "..." }`. Also valid on `notch reply` and `create_reply` (replies can carry next-step instructions for the parent's recipient).
  - **Verification:** create packet with `--next-steps`, assert field round-trips through frontmatter; preview output includes the Next Steps section.

- [ ] **Step 3.3: Update agent prompt packs**
  - **Files:**
    - `src/cli/prompts/claude-code.ts` — MODIFIED
    - `src/cli/prompts/claude-desktop.ts` — MODIFIED
    - `src/cli/prompts/codex.ts` — MODIFIED
    - `src/cli/prompts/cursor.ts` — MODIFIED
    - `src/cli/prompts/claude-chat.ts` — MODIFIED (web-chat bridge: the chat-side prompt can emit `nextSteps`)
  - **Implementation:** add one sentence per prompt: "When packaging context for another tool, include a `nextSteps` field describing what the receiving agent should do — short, imperative, file paths included where relevant."
  - **Verification:** prompt snapshots reviewed and intentional.

## Wave 4: `packet pack` / `packet unpack`

Transport convenience. The folder is canonical on disk; the `.notchpkt` archive is for moving across machines via existing channels (scp, email, iCloud, git LFS, whatever).

- [ ] **Step 4.1: `notch packet pack <id>` produces `.notchpkt`**
  - **Files:**
    - `src/cli/commands/packet.ts` — MODIFIED (new subcommand)
    - `src/core/archive-service.ts` — NEW
    - `src/cli/program.ts` — MODIFIED
    - `tests/cli/packet-pack.test.ts` — NEW
    - `tests/unit/archive-service.test.ts` — NEW
  - **Implementation:** `notch packet pack <id> [--output path]` reads the packet folder, produces a gzipped tar with deterministic entry ordering (sorted by path) and zeroed timestamps so the output is byte-identical across runs. Default output: `<cwd>/<packet-id>.notchpkt`. `--output -` writes to stdout for piping (`notch packet pack <id> --output - | scp - host:~/...`). Uses `tar-stream` (existing JS, no native deps).
  - **Verification:** pack of a fixture packet produces a deterministic byte-identical archive across runs; archive contains `packet.md`, `manifest.json`, `artifacts/*`.

- [ ] **Step 4.2: `notch packet unpack <archive>` lands in inbox**
  - **Files:**
    - `src/cli/commands/packet.ts` — MODIFIED
    - `src/core/archive-service.ts` — MODIFIED
    - `src/core/transfer-service.ts` — MODIFIED (factor folder-import so unpack can call it)
    - `tests/cli/packet-unpack.test.ts` — NEW
  - **Implementation:** `notch packet unpack <archive>` extracts to a temp directory, validates layout (`packet.md` + optional `manifest.json` + optional `artifacts/`), runs the folder-import path from Step 2.5 (hash verification, immutability, audit). Archive accepts a path or `-` for stdin. Hostile archives (path traversal, symlinks, absolute paths) raise `NOTCH_ARCHIVE_UNSAFE`.
  - **Verification:** unpack round-trips a packed packet; unpack rejects a tarbomb fixture; unpack of a hash-tampered archive fails at the import step.

## Wave 5: Scanner Over Artifact Bytes

Extends the V1.1 secret scanner so artifact bytes are scanned at create time. Text-like artifacts by extension allowlist; binaries are skipped with an audit-log note (full-scanning a JPEG is silly and full-scanning an HTML can catch tokens in inline JS).

- [ ] **Step 5.1: Text-like extension allowlist and scan integration**
  - **Files:**
    - `src/core/secret-scan-service.ts` — MODIFIED (extension allowlist; new `assertNoSecretsInArtifactWithAudit`)
    - `src/core/artifact-service.ts` — MODIFIED (call scanner before copy)
    - `src/core/config-service.ts` — MODIFIED (config knob to extend the allowlist)
    - `tests/unit/secret-scan-service.test.ts` — MODIFIED
  - **Implementation:** seed allowlist: `.md .txt .html .htm .css .js .mjs .cjs .ts .tsx .jsx .json .yaml .yml .toml .ini .py .rb .sh .bash .zsh .env.example .gitignore .conf .xml .svg`. Files matching the allowlist are read into memory (subject to Wave 6 size cap) and scanned via the V1.1 scanner with `field: "packet artifact <path>"`. Failures abort the packet write before any bytes are copied; failures append to audit log like any other blocked write.
  - **Verification:** scan trips on a poisoned HTML artifact; passes on a clean Markdown; passes on a JPEG (skipped); audit log records both hit and skip.

- [ ] **Step 5.2: Binary skip emits one-line audit entry**
  - **Files:**
    - `src/core/secret-scan-service.ts` — MODIFIED
    - `src/core/audit-service.ts` — MODIFIED (new `operation: "scan-skip"`)
    - `tests/unit/audit-service.test.ts` — MODIFIED
  - **Implementation:** when an artifact extension is not in the allowlist, write one audit entry: `{ operation: "scan-skip", recordType: "packet", recordId, path: "artifacts/...", reason: "extension-not-in-allowlist" }`. No warning to the user — the skip is by design and routine.
  - **Verification:** packet with a JPEG produces exactly one `scan-skip` audit entry; packet with two binary artifacts produces two.

## Wave 6: Size Caps

Prevents accidentally bundling a 4GB video. Soft warning at 80% of cap, hard reject at 100%. Both bounds are configurable (`config.json` → `artifacts.maxArtifactBytes`, `artifacts.maxPacketBytes`) with the documented defaults.

- [ ] **Step 6.1: Per-artifact and per-packet enforcement**
  - **Files:**
    - `src/core/artifact-service.ts` — MODIFIED
    - `src/core/config-service.ts` — MODIFIED (defaults: artifact 50MB, packet 200MB)
    - `src/types/errors.ts` — MODIFIED (new `NOTCH_ARTIFACT_TOO_LARGE`, `NOTCH_PACKET_TOO_LARGE`)
    - `tests/unit/artifact-service.test.ts` — MODIFIED
  - **Implementation:** stat each `--file` before reading. If size ≥ 100% of per-artifact cap → reject. If sum of accepted artifact sizes ≥ 100% of per-packet cap → reject. Soft warnings (≥ 80%) emit `NotchError` warnings on the result; do not block.
  - **Verification:** 60MB file → hard reject; 45MB file → write + warn; two 110MB files in one packet → second is hard reject; clean small packet → no warnings.

## Wave 7: Schema Version Bump

- [ ] **Step 7.1: Bump `schemaVersion` to `0.4.0` on new packets**
  - **Files:**
    - `src/core/record-factory.ts` — MODIFIED
    - `src/schemas/shared.schema.json` — MODIFIED (current version constant)
    - `tests/unit/record-factory.test.ts` — MODIFIED
  - **Implementation:** new packets declare `schemaVersion: "0.4.0"`. Readers continue to accept `0.3.x` and `0.2.x` packets (V2 and V1 substrate is intact).
  - **Verification:** newly created packet has `schemaVersion: "0.4.0"`; importing a V2 packet still works.

- [ ] **Step 7.2: Back-compat smoke for V2 single-file packets**
  - **Files:**
    - `tests/e2e/v2-back-compat.test.ts` — NEW
    - `fixtures/v2-back-compat/.notch/` — NEW (a fixture V2 store with single-file packets, briefs, marks, replies)
  - **Implementation:** end-to-end fixture: a `.notch/` store created under V2 with single-file packets, no `manifest.json`, no `artifacts/`. V3 build reads it, lists packets, imports them, runs `check`, runs `doctor`. No failures, no migrations.
  - **Verification:** all V2 records survive; no rewrites; `notch check` reports zero new findings against V2 fixtures.

## Wave 8: Close The Loop

- [ ] **Step 8.1: Update CHANGELOG.md** — `0.4.0` section listing: folder-canonical packets, `artifacts[]` schema field, `nextSteps` schema field, `--file` (copy-bytes default), `--ref` (pointer-only opt-in), `manifest.json` per packet, `notch packet pack`, `notch packet unpack`, `.notchpkt` archive format, scanner extension over text-like artifacts, size caps (50MB/200MB), schema version `0.4.0`. Note V2 single-file packets remain readable without migration.

- [ ] **Step 8.2: Update README beyond the V3-memo session edits** — the V3-memo session already (a) demoted the web-chat bridge to a fallback and (b) added "Where We Want Help." V3 completion also adds: (c) a new headline quickstart path showing the brand-handoff bundle case (Claude Desktop saves files via filesystem MCP, calls `create_packet` with `--file` and `--next-steps`, Codex reads the inbox), (d) a one-paragraph note on `notch packet pack` / `unpack` for cross-machine, and (e) explicit "V2 packets keep working" reassurance for users upgrading.

- [ ] **Step 8.3: Bump package version and run full verification** — `0.4.0`. Lint, type-check, build, test, e2e. CLI smokes: `--help`, `--version`, `packet create --file ... --next-steps ...`, `packet pack <id>`, `packet unpack <archive>`, `packet preview <id>`, `packet list`, `packet show <id>`, `check`, `doctor`, plus the V2 back-compat smoke from Step 7.2.

## Final: E2E Smoke For V3 Workflows

- [ ] **Step 9.1: Brand-handoff smoke (the headline)** — fixture script: create a source store, write `mascot.jpg` and `showcase.html` to disk, run `notch packet create --to-agent codex --to-repo <dest> --file mascot.jpg:asset --file showcase.html:source --next-steps "Build a one-page site at apps/brand-site/ using showcase.html as the layout and mascot.jpg in the hero." --summary "Brand handoff for the launch page."`. Assert: packet folder exists with `packet.md`, `manifest.json`, `artifacts/mascot.jpg`, `artifacts/showcase.html`. Hashes match. `nextSteps` present in frontmatter. Copy folder into destination's `.notch/inbox/`. From the destination, `notch packet show <id>` prints the next steps; `notch packet preview <id>` lists both artifacts.

- [ ] **Step 9.2: Pack/unpack round-trip smoke** — `notch packet pack <id>` → `<id>.notchpkt`. Move the file. `notch packet unpack <id>.notchpkt`. Assert byte-identical folder. Hash verification passes. Audit log records the import.

- [ ] **Step 9.3: Hash-mismatch import smoke** — pack a packet, tamper with one byte of one artifact inside the archive, unpack. Assert `NOTCH_ARTIFACT_HASH_MISMATCH` is raised, audit log records the failed import, no partial state is left in inbox.

- [ ] **Step 9.4: Size-cap smoke** — fixture with a 60MB binary artifact: hard reject. Fixture with a 45MB artifact: write + warn. Fixture with three 80MB artifacts: first two land, third hard-rejected as packet cap reached.

- [ ] **Step 9.5: Scanner-on-artifact smoke** — fixture with a poisoned HTML artifact containing a JWT-like token: write blocked, audit log records the block. Fixture with a clean Markdown artifact: write succeeds. Fixture with a JPEG: write succeeds, audit log records `scan-skip`.

- [ ] **Step 9.6: V2 back-compat smoke** — covered by Step 7.2 fixture; re-run as part of the E2E suite.

- [ ] **Step 9.7: `--ref` smoke** — `notch packet create --ref ./shared/asset.md --to-repo ../sibling-store` produces a packet with `includedSourceLinks` populated and `artifacts[]` empty. Receiving side resolves the link relative to the sender's `project.root` (existing V2 behavior unchanged).

## Out Of V3 Scope (deferred to V3.1 or later, or flagged in "Where We Want Help")

- Connector / remote-MCP mode for web-chat ingest. Structurally honest replacement for the clipboard fallback; lives in "Where We Want Help" as community-contribution target. V3.1 candidate.
- `notch packet send` or any transport verb that drives scp/rsync/iCloud/etc. The OS already does this; documentation in "Where We Want Help" covers the recipes.
- Signing / verification of bundle authorship. Hashing covers integrity; signing requires key management 3Notch will not own yet.
- DXT packaging for Claude Desktop. Carried from V2 deferral; community-buildable.
- Encryption at rest for `.notch/private/`. Carried from V1.1 and V2.
- Reply surfacing UX, resolution semantics, digests. Carried from V2.
- Wiki / browse / graph UI over `relationships.json`. Carried from V2.
- Auto-tagging, similarity threading, contradiction flagging. Carried from V2.
- Cross-store / cross-user aggregation. Carried from V2.
- Mobile / voice intake. Carried from V2.
- Additional `notch check` rules beyond V2's five. Wait for demonstrated demand.
- `lint` verb. Held out permanently per V2 IP-hygiene commitment.

## Forward-Compatibility Commitments

These are not V3 features. They are contracts so external tooling and agent prompts built against V3 don't need to change when later versions ship.

- **V2 single-file packets remain readable indefinitely.** V3 does not migrate or rewrite them. Successors are authored via `supersedes`, not by mutating predecessors.
- **The packet folder is the immutable unit.** `packet.md`, `manifest.json`, and any file under `artifacts/` cannot be overwritten in inbox. Changes require a successor folder with `supersedes`. V3 does not define a retraction pattern; one will be designed in a later version with at least 6 months' notice.
- **`artifacts[].sha256` is SHA-256 in lowercase hex.** Algorithm pinned for V3. If a future version adds a stronger algorithm, it will land as a parallel optional field, not as a replacement.
- **`manifest.json` is a derived artifact pinned to the packet folder.** External tooling MAY read it; it MUST NOT be written to except by 3Notch itself. Source of truth is the packet folder contents plus the frontmatter `artifacts[]` array.
- **`nextSteps` stays free text.** No enum, no DSL, no structured action verbs in V3 or beyond as a core OSS feature. Receiver-side interpretation is the agent's job.
- **`.notchpkt` = gzipped tar with deterministic entry ordering and zeroed timestamps.** Format pinned for V3. Any future archive format will be additive (different extension) and back-compat tooling will accept both.
- **`--file` (copy default) and `--ref` (pointer opt-in) semantics are pinned.** Flipping the default in a future version requires a major version bump and a deprecation cycle.
- **No new top-level record types in V3.** Artifacts ride on packets via `artifacts[]`. Pack/unpack is transport, not a new record kind.
- **`notch check` rules unchanged in V3.** New rules wait for demonstrated demand and land in V3.1+ behind their own plan.
- **The verb `lint` remains reserved and held out of 3Notch OSS in perpetuity.** Carried from V2 IP-hygiene commitment.

V3 is shipped and archived. If a V3.1 plan is needed later, it lands in `docs/active-plans/v3.1/` during development and moves to `docs/archived-plans/v3.1/` when shipped.

## Implementation Log

V3 implementation progress is preserved in `docs/archived-plans/v3/v3-implementation-log.md`.
