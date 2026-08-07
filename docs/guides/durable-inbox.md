# Durable Inbox

Durable inbox is a local filesystem spool for asynchronous `.notchpkt` handoff. Use it when two agents or repos cannot rely on one live chat or one shared `.notch/` store, but can intentionally access the same local or mounted mailbox root.

It adds delivery, not chat. Packets remain the unit of context, existing import validation remains authoritative, and acknowledgements retain the original archive.

## Configure Both Sides

Choose one explicit mailbox root. Each store registers its own address:

```bash
# In the sender repo
notch inbox init --name build-agent --root /shared/3notch-mailbox

# In the receiver repo
notch inbox init --name review-agent --root /shared/3notch-mailbox
```

The commands print `local:build-agent` and `local:review-agent`. Configuration lives in ignored `.notch/inbox-config.json`; the absolute root is machine-local and is not added to packet records.

Every sender should have an address so a reply has a clear return destination. A name is a safe routing label, not authenticated identity.

## Send

Create and pack an ordinary project handoff, then send the archive:

```bash
notch packet create \
  --title "Review auth change" \
  --summary "Auth change is ready for an independent review." \
  --to-agent review-agent \
  --file src/auth.ts:source \
  --next-steps "Review src/auth.ts and reply with findings."

notch packet pack <packet-id>
notch send <packet-id>.notchpkt --to local:review-agent
```

Before a shared-mailbox write, 3Notch checks that the source is a regular `.notchpkt`, caps compressed and unpacked work, validates packet and artifact schemas, verifies artifact hashes, scans packet text and text-like artifacts, and blocks private or seed packets. The recipient must already be registered; a typo does not create a new mailbox.

Retrying the same packet ID and exact bytes returns the existing active or completed delivery. Reusing a packet ID with different archive bytes fails. A terminally rejected delivery is never reported as a successful resend; correct the packet and create a new packet ID instead.

## Receive

List pending deliveries:

```bash
notch inbox list
```

Verify without importing:

```bash
notch inbox pull <delivery-id>
```

Verify and import through normal 3Notch validation:

```bash
notch inbox pull <delivery-id> --import
notch packet preview <packet-id> --inbox
notch check
```

After review, acknowledge it:

```bash
notch inbox ack <delivery-id>
```

Ack never deletes packet bytes. `notch inbox list` shows pending only; `notch inbox list --all` includes pulled, acknowledged, and rejected history.

## Reply

Reply to the imported packet normally, then pack and send the reply to the original sender's address:

```bash
notch reply <parent-packet-id> \
  --type confirmation \
  --summary "Review complete." \
  --next-steps "Continue from the confirmed handoff."

notch packet pack <reply-packet-id>
notch send <reply-packet-id>.notchpkt --to local:build-agent
```

The existing `replyTo` relationship survives delivery and import.

## MCP And Cross-Model Use

The local stdio MCP server exposes the same workflow:

- `inbox_init`
- `send_packet`
- `list_inbox`
- `pull_inbox_packet`
- `ack_inbox_delivery`

This is the neutral boundary for Claude, Codex, Grok, Cursor, ChatGPT, or any other MCP client that can run the 3Notch stdio server. Tools return small structured results with delivery ID, packet ID, byte hash, state, path, optional imported packet ID, and next action.

`send_packet` is annotated as an externally visible write. List is read-only. Pull and ack mutate state; ack is non-destructive. Client approval and `.notch/config.json` write-tool policy still apply.

A future remote adapter can expose the same contracts over authenticated MCP Streamable HTTP. It does not need to add model-to-model calls, hosted identity, or vendor branches to this local core.

## Local Traces

Lifecycle events append to ignored `.notch/logs/audit.jsonl`:

- `inbox-init`
- `inbox-send`
- `inbox-pull`
- `inbox-ack`
- `inbox-reject`

Events include routing labels, delivery and packet IDs, SHA-256, byte count, state, actor/source tool, and error code when relevant. They do not include packet content or credentials.

## Honest Limits

- The local adapter does not authenticate addresses, authorize users, sign senders, or encrypt archives.
- Anyone with filesystem access to the mailbox root may be able to read or change it. Use OS permissions and disk encryption appropriate to the data.
- SHA-256 detects changed bytes; it does not prove who authored them.
- One-host locking and atomic renames are tested. Unmanaged sync-conflict files are ignored during listing, while malformed entries using the managed delivery-ID namespace still fail closed. Dropbox, iCloud, Syncthing, network mounts, and similar products have their own conflict and availability behavior; V1 does not claim distributed locks or guaranteed delivery across them.
- There is no daemon, polling loop, notification service, account, hosted relay, retention deletion, or remote network listener.
- Private and seed packets are intentionally blocked from this shared-mailbox flow.

If no config exists, run `notch inbox init`. A local size-limit failure remains pending: review the source, raise the receiver limit when appropriate, and pull the same delivery again. For a terminal rejection, use `notch inbox list --all`, preserve the evidence, and ask the sender for a corrected packet with a new packet ID rather than editing mailbox files.
