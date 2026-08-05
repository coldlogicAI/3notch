# 3Notch V5 — Durable Inbox

Status: implementation complete; ready for review
Branch: `agent/2026-08-04-durable-inbox`
Base: `a9006ca`

## Goal

Let two separately configured 3Notch stores exchange immutable `.notchpkt` files asynchronously through one explicit local mailbox root. Preserve the existing packet, import, reply, privacy, audit, and MCP model.

## Product Contract

```text
notch inbox init --name <name> --root <path>
notch send <packet.notchpkt> --to local:<recipient>
notch inbox list [--all]
notch inbox pull <delivery-id> [--import] [--as-reviewed]
notch inbox ack <delivery-id>
```

Matching MCP tools:

- `inbox_init`
- `send_packet`
- `list_inbox`
- `pull_inbox_packet`
- `ack_inbox_delivery`

The CLI and MCP return the same small structured result fields. Tool descriptions and server instructions explain the pack → send → list → pull/import → ack sequence.

## Simplicity Boundary

V5 is a filesystem spool around existing packets. It is not chat, sync, identity, hosting, agent invocation, or a database. It adds no daemon or dependency. The local adapter does not interpret packet content. The service layer reuses existing packet validation before delivery and import.

The CLI/MCP schemas are the stable boundary for a later authenticated Streamable HTTP adapter or plugin. That future layer can serve Claude, Codex, Grok, and other MCP clients without vendor branches in the inbox core.

## Storage

Each store keeps ignored machine-local config at `.notch/inbox-config.json`:

```json
{
  "schemaVersion": "1.0.0",
  "transport": "local",
  "name": "review-agent",
  "address": "local:review-agent",
  "root": "/explicit/mailbox/root"
}
```

The root contains recipient markers and immutable delivery directories. Each delivery contains validated metadata, exact archive bytes, and a SHA-256 sidecar. Delivery state is `pending`, `pulled`, `acked`, or `rejected`; ack never deletes bytes.

Delivery IDs are deterministic from the packet ID. Same ID + same archive hash is an idempotent retry. Same ID + different bytes is a conflict.

## Security And Durability

- Require an explicit root and a registered recipient; typo addresses fail.
- Reject unsafe names, traversal, symlinks inside the managed tree, non-regular files, malformed metadata, archive bombs/oversize input, hash mismatch, private packets, seed packets, secret-bearing packets, and invalid packet/artifact schemas.
- Validate and scan before the archive enters the shared root; validate the byte hash again before pull/import.
- Stage a complete delivery beside its destination and rename once; never expose partial delivery directories.
- Serialize recipient mutations using the existing short-lived filesystem lock and clean failed temp state.
- Keep address labels honest: local labels are not authenticated identities, encryption, or authorization.
- Append local redacted audit events for init, send, pull/import, ack, rejection, and failure. Never log packet content, credentials, or payment/auth data.

## Verification

- Unit: config/address/metadata/state validation, adapter CRUD, idempotent and conflicting retries, corruption, unsafe paths/symlinks, limits, private/seed/secret rejection, cleanup, audit events, and concurrency.
- CLI: useful human output, JSON parity, missing-config guidance, full state loop.
- MCP: schemas, annotations, read-only enforcement, structured results, full tool loop.
- E2E: two clean repos exchange request and reply, preserve `replyTo`, pass `notch check`, reject corruption/conflicts, and produce valid traces.
- Package: install packed tarball into a clean temp prefix and repeat the request/reply loop with built CLI.
- Repository: lint, type-check, build, all tests, e2e, no-secret diff, dependency audit review, clean focused commit.

## Non-goals

- Hosted relay, remote MCP transport, OAuth, accounts, keys, signatures, encryption, team ACLs, retention/delete, background polling, guaranteed sync-folder semantics, or model-to-model invocation.
- Changes to packet meaning, relationship semantics, `notch check`, private MCP visibility, or Stoa commercial logic.
