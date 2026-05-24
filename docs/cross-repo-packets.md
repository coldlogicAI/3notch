# Cross-Repo Packets

Packet transfer is the main V1 loop: one repo creates a reviewable Markdown packet, another repo imports it.

## Create

```bash
notch packet create \
  --title "Current repo state" \
  --summary "Checkout and admin settings changed." \
  --to-agent claude \
  --to-person marketing \
  --to-repo ../destination-app \
  --file README.md
```

The packet is written to `.notch/outbox/`. Recipient fields answer who the packet is meant for. They do not send data, grant access, or authenticate a recipient in V1.

## Import

```bash
notch packet import ../source-app/.notch/outbox/<packet-file>.md
notch packet list --inbox
notch packet show <packet-id> --inbox
```

Import writes a copy to `.notch/inbox/`. It does not merge context into the destination project brief or overwrite local records.

## Review Model

- Inspect packets before import when the source is not trusted.
- Use `notch doctor` to validate records and rebuild derived indexes.
- Keep source links explicit so recipients can see what the summary was based on.
