# Privacy And Security

3Notch V1 is local-first, explicit, and file-based.

Local-first does not mean same-repo only. It means 3Notch has no hosted relay, background receiver, account system, cloud inbox, telemetry, or remote connector in V1. Cross-repo and cross-tool movement happens through local packet files and local MCP calls that the user or agent explicitly initiates.

## What V1 Does

- Stores human-readable records under `.notch/`.
- Writes created packets to `.notch/outbox/`.
- Writes imported packets to `.notch/inbox/`.
- Writes private seed context under `.notch/private/`.
- Ignores `.notch/private/`, `.notch/index/`, and `.notch/logs/` by default.
- Hides private records from MCP unless `--include-private` is set.
- Scans writes for configured sensitive patterns, JWT-like strings, private-key markers, and high-entropy token-like strings.

## What V1 Does Not Do

- It does not verify another person or device.
- It does not deliver packets to a remote recipient.
- It does not accept packets from a network listener.
- It does not scrape hidden chat or project state.
- It does not execute arbitrary shell commands through MCP.

## Choosing Recipients

Use packet recipient fields:

```bash
notch packet create --to-agent codex --to-person alex --to-repo ../destination
```

These fields help route and review the packet. Access control in V1 is the local filesystem and the user's choice to share or import a packet.

## Receiving Packets

You receive a packet only when you import a file:

```bash
notch packet import /path/to/packet.md
```

Review unknown packets before import. `notch doctor` validates the local store after import.
