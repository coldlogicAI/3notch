# 3Notch V3 Memo

> **Status: background reading. Not required for implementation.** The nine decisions in Section 7 are locked and have been translated into the V3 implementation plan at `docs/active-plans/v3/3notch-v3-plan.md` — implementing agents should read the plan, not this memo. This document is preserved for product-decision context (refused options, the "underbuilt vs underscoped" V2 diagnostic, the assumed user goal, the brand rename considered-and-rejected reasoning) that the plan does not duplicate. Useful when scoping V4 or revisiting why V3 refused transport/identity/relay; not useful for executing V3.

## 1. Product Thesis

**3Notch is the format and the local plumbing for a hand-off you direct but no longer have to carry by hand — the bytes move between tools on your machine; you stay the author and reviewer.** Not memory. Not a wiki. Not a hub. A packet — addressed to a specific recipient, containing the things they need to act, that any tool with filesystem access can produce and any tool with filesystem access can consume.

The neutrality is the moat. No vendor will build the cross-vendor pipe. A local, file-based, schema-stable artifact format is the only place this can be solved without picking a winner.

What goes away in V3 is *you being the bus* — the manual copy-paste transport role. What stays, by design, is your role as the one who decides what gets packaged and reviews it before another tool relies on it. No background scraping, no automatic capture, no agent silently shipping context. The lived example starts with "Hey Claude, package this and send it." User-directed. Reviewable.

If V3 doesn't make that one sentence true for artifacts (not just text), V3 is the wrong V3.

## 2. V2 Reality Check

What V2 actually delivered, sorted by whether the gap is *underbuilt* (right scope, incomplete) or *underscoped* (wrong scope decision).

**Solid:**
- `supersedes`, `replyTo`/`replyType`/`status`, `mark`, `check`, `relationships.json`, inbox immutability, audit log, `pbpaste | notch packet import -` stdin path. The schema substrate is real. External tooling and agent prompts can be built against it.
- The Steinberger filter held — V2 resisted UX bloat. Wiki UI, surfacing flows, contradiction detection, retraction patterns all stayed deferred. Correct.

**Underbuilt:**
- The web-chat bridge does what it set out to do (text packets in via clipboard), but the framing oversold it: clipboard ingest is an *escape hatch*, not a *bridge*. The README currently leads with it as one of three canonical paths. It's actually a degraded mode for surfaces 3Notch can't reach with MCP today. Reframing is queued (see Section 7, D9).

**Underscoped — the load-bearing one:**
- **`includedSourceLinks` is references-only. The packet body lists `- path/to/file.html`, never the bytes.** `renderPacketBody` in `src/core/packet-service.ts` makes the artifact a bullet point. `--file` in `createPacket` becomes a `sourceLink` with `kind: 'file'` and a `path`. The mascot JPEG and the brand HTML cannot travel inside today's packet. Schema `includedRecords` is even more constrained — it only allows `recordType: project_brief | brief`.
- **There is no structured "do this with these files" field.** Today the receiving agent has to infer intent from the free-text `summary`. The brand-handoff case has a literal task ("build a website with the showcase + mascot") that has no schema home.

V2 chose schema substrate over envelope substrate. Defensible (substrate is foundational; envelope builds on top), but it means the most-evocative use case in the product positioning — Claude Desktop → Codex with artifacts — does not work end-to-end on the user's own machine today. That's not a polish gap. That's the headline.

## 3. Use-Case Matrix

| Use case | V2 status | Diagnosis |
|---|---|---|
| Same-project local MCP handoff (both clients → same `.notch/`) | Works for text | Capture gap: bytes from Claude artifact pane never hit disk unless filesystem MCP writes them first |
| Claude Desktop / Codex / Cursor handoff, one machine | Works for text references | Same envelope gap. Lived-pain case. |
| Web chat → local project | Works for text via clipboard | Constrained today; structurally solvable via custom connectors / remote MCP (see Section 6). |
| Cross-repo handoff (same machine) | Works | Solid. V2's home case. |
| Cross-machine, same user | "Works" if you copy a markdown file via scp | Envelope is one file, not a bundle. Multi-file bundle would need pack/unpack. Transport itself: not 3Notch's problem. |
| Cross-user (teammate) | Same as cross-machine + a channel | Downstream of envelope. Don't build separately. |
| Private personal context | Works | `.notch/private/` + marks. Solid. |
| Artifact transfer (text + binary) | **Does not work** | The core V3 gap. |
| Team/org routing | Not addressed | Premature. Skip. |
| Future wiki / corpus use | Substrate ready | Agent-side. Not 3Notch core. Keep as-is. |

## 4. V3 Candidate Scopes

### (a) Polish-only: tighten what V2 didn't quite land
Better recipient routing, clearer audit summaries, better doctor output, maybe surface `check` findings in `status`. **Verdict: ships nothing the product needs.** The brand-handoff case still doesn't work. This is the option that fails the "ship the minimum that actually works" filter. Reject.

### (b) Context bundles with artifacts — recommended
Packets become envelopes that can carry file bytes. Folder-form on disk. Optional `pack` / `unpack` for archive form. One optional structured field for receiver intent (`nextSteps` string, free-form). Hash manifest for integrity. Scanner runs over included bytes at create time. Inbox immutability extends to the folder. No transport. No identity. No relay.

This is the smallest thing that makes the brand-handoff case work. Everything else V3 might add (search, browse, sync) can layer on top later.

### (c) Deliberately refuse transport / identity / hosted in V3
**Honor this.** The user's existing kit already moves files between machines (scp, rsync, Tailscale, Syncthing, iCloud, git). A 3Notch-shipped transport would be re-implementing OS plumbing badly, would force identity/auth work, and would invalidate the "no hosted service" promise. The only use case that would override this — real-time multi-user collaboration — is not the target archetype. Refuse.

Caveat: this refusal applies to *3Notch shipping its own transport*. It does not preclude 3Notch shipping an optional HTTP/SSE MCP mode that a user wires to a web-chat surface via Anthropic's custom-connector flow (see Section 6 and Section 7, D9). That path uses Anthropic's connector mechanism plus a user-controlled tunnel (Tailscale, Cloudflare); 3Notch doesn't host or proxy anything.

### (d) Better fourth option?
Candidate: **packet-folder + a "send to receiver" verb that shells out to whatever the user has configured** (e.g., `notch packet send <id> --via scp:user@desktop:~/.notch/inbox/`). Tempting because it makes cross-machine a one-liner. But it's a transport wrapper with a different name, and the failure modes (auth prompts, retries, partial transfers) drag identity/state in by the back door. Skip in V3. Document the OS-native patterns instead.

**Recommendation: (b) only.**

## 5. Context Bundle Design

The mascot-JPEG / brand-showcase / Codex example, made concrete.

### On disk

```text
.notch/outbox/2026-05-25-brand-handoff-to-codex/
  packet.md                 # frontmatter + summary + nextSteps + manifest
  artifacts/
    mascot.jpg
    showcase.html
    build-plan.md
  manifest.json             # SHA-256 of each artifact, byte size, recorded at create
```

Each packet is a directory. The `.md` file at the root is still the human-readable record V2 has — the existing schema, plus three small additions:

```yaml
# new optional fields in packet.schema.json
nextSteps: string                       # what the receiving agent should do (DECIDED: schema field, not convention)
artifacts:                              # replaces single-purpose includedRecords for files
  - path: artifacts/mascot.jpg
    sha256: ...
    bytes: 84210
    purpose: asset                      # asset | source | reference | output
  - path: artifacts/showcase.html
    sha256: ...
    bytes: 12044
    purpose: source
```

The `artifacts[].purpose` field is the only mild over-design; if it's not earning its keep in V3.1, collapse it.

### Folder vs archive

Folder is canonical. Archive (`.notchpkt` = gzipped tar of the folder, deterministic ordering) is for transport — produced on demand by `notch packet pack <id>`, consumed by `notch packet unpack <file>`. Two verbs. Inbox stores the unpacked folder.

Folder-canonical preserves the V1 "human-readable source of truth" promise. You can `cat packet.md`, `open artifacts/mascot.jpg`, browse with Finder. An archive is a transport convenience, not a storage choice.

### Copy bytes vs reference

Default to copy. `--file path/to/asset.jpg` now reads bytes, writes into the bundle's `artifacts/`, records hash. `--ref path/to/asset.jpg` (new flag) keeps the V2 behavior — pointer only — for when sender and receiver share a workspace and duplicating bytes is wasteful. Two modes, explicit, no mode-switching magic.

### Integrity

SHA-256 per artifact, recorded in `packet.md` frontmatter and in `manifest.json`. On import, verify and fail-loud on mismatch. Don't ship signing in V3 — no key management story to take on. Hashing alone gives you "this is the same bundle that left the sender," which is what the audit log wants.

### Where receiving instructions live

**Decision (locked):** add one optional top-level field: `nextSteps` (string). Documented convention: this is what the receiving agent should do with the bundle. Agents and prompt packs read it explicitly. Keep `summary` as the "why this exists." `nextSteps` as the "what you should now do." Free text the agent interprets — no enum, no DSL.

V2 already added 4 optional fields; one more does not destabilize the contract, and the structural field gives prompt packs a known place to look rather than relying on a Markdown-heading convention inside `summary`.

### Worked example — what the user actually does

In Claude Desktop, with filesystem MCP enabled:
> "Save the brand-showcase HTML to `./out/showcase.html`, save the mascot to `./out/mascot.jpg`, then create a 3Notch packet to Codex with both files, summary describing the design choices and user preferences from this chat, and next steps telling Codex to build a one-page site at `apps/brand-site/` using Next.js."

Agent calls:
1. `filesystem.write_file` × 2 (mascot, showcase) — existing MCP, not 3Notch.
2. `create_packet` with `toAgent: "codex"`, `toRepo: "../brand-site"`, `files: ["./out/showcase.html", "./out/mascot.jpg"]`, `summary: "..."`, `nextSteps: "Build a one-page Next.js site at apps/brand-site/ using showcase.html as the layout and mascot.jpg in the hero."`

3Notch:
- Scans HTML and JPG for secrets/PII patterns (per D6).
- Hashes each.
- Writes `outbox/<id>-to-codex/` folder with `packet.md`, `artifacts/`, `manifest.json`.
- Appends audit entry.
- Rebuilds `relationships.json`.

User runs:
```bash
notch packet preview <id>            # see folder contents + summary + nextSteps
# for same-machine cross-tool, copy the folder into the destination's .notch/inbox/:
cp -r .notch/outbox/<id-folder>/ ../brand-site/.notch/inbox/
# for cross-machine, pack and ship via existing channel:
notch packet pack <id> | scp - desktop:~/staging/
# on desktop:
notch packet unpack ~/staging/<id>.notchpkt
```

In Codex:
> "Read the new 3Notch packet in inbox and follow its next steps."

Codex calls `list_packets`, sees the new one, calls `get_packet`, reads `nextSteps`, reads `artifacts/showcase.html` from disk, reads the JPG bytes, builds the site.

That's the whole loop. One machine, no copy-paste of artifacts. The user directed it and can review the bundle at any step; they just don't have to be the byte-carrier.

### Capture gap (the part worth naming)

For this to work, **the source-side AI tool needs filesystem write access to put the artifacts on disk before `create_packet` runs.** Claude Desktop (with filesystem MCP), Codex, Cursor, Claude Code all have it. ChatGPT web and Claude.ai web do not.

Implication for V3 scope: 3Notch's job ends at "given files on disk, bundle them." Getting the files on disk in the first place is the source tool's responsibility. For tools without that capability today, the user still saves manually for that one step — until connectors / remote MCP close the gap (see Section 6).

## 6. OSS vs Commercial Split

Be honest: the commercial layer the V1 doc gestured at (encrypted sync, team workspaces, managed MCP, browser UI) is **premature**. There are no team users. There is no demonstrated demand for sync the user can't satisfy with iCloud or rsync. Building it would force identity, auth, key management, and a hosted-service liability surface the project has explicitly avoided.

Smaller wedges, ranked by realism:

1. **DXT packaging for Claude Desktop.** One-click install of the MCP server. Plausibly free; modest moat. Anthropic might absorb the pattern. Community-buildable.
2. **Notarized binaries / signed installers across OSes.** Convenience. Hard to charge for. Community-buildable.
3. **Optional HTTP/SSE MCP mode for 3Notch.** Lets a user expose their local store to Claude.ai (or any connector-capable surface) via Anthropic's custom-connector flow plus a user-controlled tunnel (Tailscale, Cloudflare). 3Notch doesn't host or proxy; the user owns the endpoint. This is the structurally-honest path for the web-chat case — replaces the clipboard fallback. Could land in V3.1 or be community-contributed; not V3 core.
4. **Hosted "packet directory" (npm-for-context).** Browse and pull seed packets contributors publish. Interesting community play. Not commercial.
5. **Managed instance for small teams.** A shared `.notch/` on object storage, with a thin web reader. Real commercial wedge — but premature until team usage is observed and the OSS substrate has stabilized enough that you're confident you won't iterate the schema underneath paying customers.
6. **3Notch-hosted relay.** The biggest UX unlock for cross-machine. Also the biggest scope creep — identity, auth, encryption, abuse handling, uptime. Not V3. Possibly never; OS-native channels plus optional remote MCP cover most of the value.

The honest read: **the commercial layer is a 2-year-out problem at minimum.** V3 should ship the envelope, watch how OSS users actually use cross-machine handoff in practice, and let the commercial wedge crystallize from observed friction rather than forecast.

## 7. Decisions (locked)

All nine decisions resolved in this session. Treat as final inputs to the V3 implementation plan.

1. **Folder-canonical packets.** Each packet is a directory; the V2-style single-file `.md` remains valid as the degenerate case (packet with no artifacts). Inbox immutability, audit log, `packet show`, `packet preview` extend to the folder. Keystone decision — every packet read/write path is touched.
2. **`nextSteps` is a schema field.** Optional free-text string at the top level of the packet schema. Gives prompt packs a known place to read rather than parsing Markdown headings out of `summary`.
3. **Copy-bytes is the default; `--ref` is the pointer-only opt-in.** `--file path/to/asset` reads bytes into the bundle's `artifacts/` and records hash. `--ref path/to/asset` preserves V2 pointer behavior for cases where sender and receiver share a workspace.
4. **Archive format: `.notchpkt` = gzipped tar with deterministic ordering.** No custom binary framing. Standard tools can inspect a `.notchpkt` if 3Notch isn't installed.
5. **Hash algorithm: SHA-256 only.** Single algorithm in `manifest.json` and in the `artifacts[].sha256` field.
6. **Scanner: full-scan text-like artifacts by extension allowlist; skip binaries with a one-line audit-log entry.** Allowlist seeded from common text formats (md, txt, html, css, js, ts, json, yaml, py, sh, etc.) and extensible via config.
7. **Size caps: 50MB per artifact, 200MB per packet, soft warning before hard reject.** Soft warning fires at 80% of each cap; hard reject at 100%.
8. **Schema version bump to `0.4.0`.** Additive schema changes are back-compat with V2 readers, but the folder-canonical layout warrants a minor bump so consumers can branch on the version when they need to.
9. **Web-chat bridge: demoted from headline to fallback.** The `notch prompt --client claude-chat` + `pbpaste | notch packet import -` flow leaves the canonical-quickstart slot in the README. Reframed as a fallback for surfaces without filesystem/MCP access. The structurally-honest replacement (custom connectors / remote MCP) is flagged in the new "Where We Want Help" README section as a known gap open to community contribution — likely V3.1 or contributor add-on, not V3 core.

## 8. Recommendation

**Ship V3 = (b) only: context bundles with artifacts. Folder-canonical packets, one new `nextSteps` schema field, manifest with SHA-256s, optional `pack`/`unpack` for cross-machine transport via existing OS channels. Nothing else in core.**

Explicitly out of V3:
- Transport, identity, hosted relay.
- Receiver-side intent verbs / structured action enums.
- Web-chat investment beyond what V2 shipped *in core* — the connector / remote-MCP path is flagged in "Where We Want Help" as a community-contribution target, and may land as V3.1 or as a contributor add-on rather than V3 core.
- Any UX layer on top of the schema substrate (surfacing, dashboards, browse). Contributor ecosystem territory.
- Any new commercial scaffolding.

Assumed user goal: **the user is one person with multiple AI tools on (mostly) one machine, occasionally moving work to a second machine. Cross-user collaboration is not in the V3 picture.** If that assumption is wrong — if you're actually building for two-person teams now — option (b) is still the right first step, but a Q3-Q4 follow-up on transport becomes inevitable and the relay-vs-channel-agnostic decision needs to be made deliberately, not deferred indefinitely.

Tradeoffs to acknowledge:
- Folder-canonical packets are a bigger contract change than V2's optional fields. The "open the markdown file in your editor and it's everything" property weakens — now you might need to look in `artifacts/` too. Worth it for the use case.
- Doubling bytes (copy by default) costs disk. Acceptable for the audience; reference mode is the escape hatch.
- Choosing not to ship transport leaves the cross-machine UX clunky. That's by design — the user has better channels than 3Notch can build in V3.
- Demoting the web-chat bridge is a marketing reframe, not a regression. The capability still exists; the README just stops overselling it, and the "Where We Want Help" section invites the connector-based replacement as community work.

The bet: solve the brand-handoff case end-to-end on one machine, ship nothing else, and let real cross-machine and cross-user usage tell you what V4 should be.
