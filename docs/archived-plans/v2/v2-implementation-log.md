# V2 Implementation Log

## 2026-05-24 - Wave 1 substrate

- Added packet relationship schema primitives for `supersedes`, `replyTo`, `replyType`, and reply `status`, while keeping marks and replies as packets.
- Added `.notch/index/relationships.json` as a deterministic derived edge index over explicit packet metadata: `supersedes`, `replyTo`, `co-tagged`, `co-recipient`, and `co-source-link`.
- Added the `NOTCH_RECORD_IMMUTABLE` guard helper for received packet overwrite attempts and documented the import audit path for `supersedes`.
- Verification: `npm test -- packet-schema relationships-service packet-service transfer-service`.

## 2026-05-24 - Waves 2-5 command surfaces

- Added `notch mark` and MCP `create_mark`; marks write private self-addressed packet records under `.notch/private/inbox/`.
- Added `notch reply` and MCP `create_reply`; replies are typed packets with `replyTo`, `replyType`, and `status: open`, with outbox/private-inbox routing based on the parent record location.
- Added `notch prompt --client claude-chat` and `notch packet import -` for web-chat packet intake through stdin.
- Added deterministic `notch check` and MCP `check_store` with only the five V2 structural rules: broken `supersedes`, broken `replyTo`, supersedes cycle, self-reference, and supersedes fork. `doctor` now surfaces a one-line check summary without changing doctor exit semantics.
- Verification: `npm test -- mark create-mark base-schemas prompt no-deferred`; `npm test -- reply create-reply relationships-service packet-schema no-deferred`; `npm test -- prompt packet`; `npm test -- check check-store doctor no-deferred`.

## 2026-05-24 - Closeout docs and E2E coverage

- Updated README, CHANGELOG, AGENTS, security docs, cross-tool docs, and the web-chat bridge walkthrough for V2.
- Bumped package and CLI version to 0.3.0.
- Added V2 E2E smokes for supersedes-chain walking, typed replies, web-chat stdin intake, marks, and corpus check rules.
