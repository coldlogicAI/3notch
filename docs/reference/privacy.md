# Privacy

3Notch is local-first, explicit, and file-based.

Local-first does not mean same-repo only. It means there is no hosted relay, background receiver, account system, cloud inbox, telemetry, or remote connector. Cross-repo and cross-machine movement happens through local files and the user's existing transport (scp, rsync, iCloud, Tailscale, email, git). Cross-tool handoff happens through local MCP calls the user or agent explicitly initiates.

## What 3Notch Does

- Stores human-readable records under `.notch/`.
- Writes created packets to `.notch/outbox/`.
- Writes imported packets to `.notch/inbox/`.
- Writes private seed context to `.notch/private/` (gitignored by default).
- Hides `.notch/index/` and `.notch/logs/` as derived output (gitignored).
- Hides private records from MCP unless the server is started with `--include-private`.
- Scans writes for configured patterns, JWT-like strings, private-key markers, and high-entropy token-like strings.
- Scans the bytes of text-like artifacts (`.md`, `.html`, source files, etc.) before they are copied into a packet bundle.
- When explicitly configured, consumes documented Claude hook fields (`task_*`, `compact_summary`, or `last_assistant_message`) and Git metadata to create continuation fallbacks.

## What 3Notch Does Not Do

- It does not verify another person or device.
- It does not deliver packets to a remote recipient.
- It does not accept packets from a network listener.
- It does not scrape hidden chat databases, browser state, or project history.
- It does not open the `transcript_path` supplied with Claude hook events.
- It does not execute arbitrary shell commands through MCP.
- It does not aggregate data across stores or users.

## Recipient Fields

```bash
notch packet create --to-agent codex --to-person alex --to-repo ../destination
```

Recipient fields label the intended audience. They help route and review the packet. They are not access control — anyone with filesystem access to the packet can read it.

## Receiving Packets

You receive a packet only when you explicitly import one:

```bash
notch packet import /path/to/packet.md
notch packet unpack /path/to/<id>.notchpkt
```

Review unknown packets with `notch packet preview <id>` before relying on them.

## Honest Limits

- When an agent reads a packet, the content may be sent to that agent's LLM provider by the client.
- 3Notch does not encrypt records at rest. Use OS disk encryption and keep `.notch/private/` gitignored.
- The scanner is a guardrail, not a proof that content is safe.
- Project-sensitivity continuation packets are Git-visible under `.notch/outbox/`; private sensitivity routes them to ignored `.notch/private/outbox/`.
- 3Notch is not a policy engine, DLP system, or audit platform.
