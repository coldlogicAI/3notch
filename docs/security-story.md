# Security Story

3Notch's security story is concrete: curate, scan, audit, review, and preserve received packets.

## Curate

3Notch stores only context a human or agent explicitly supplies. It does not scrape hidden chat databases, scan arbitrary project history, or run background collection. Source links should identify where claims came from without copying unnecessary content.

## Scan

Writes are checked before records are stored. The scanner catches configured sensitive-word patterns, JWT-like strings, private-key markers, and high-entropy token-like strings. V3 also scans text-like packet artifacts before copying them into a bundle; binary artifacts are skipped by design and recorded in the audit log. V1.1 also exposes the scanner directly:

```bash
notch scan README.md
pbpaste | notch scan -
```

The scanner intentionally blocks some benign documentation prose. When that happens, the error includes file or field context, a line excerpt, and a rephrase suggestion.

## Audit

Successful writes and blocked writes append to `.notch/logs/audit.jsonl`. The log is local and derived/noisy, but it gives users evidence that a record was created, imported, or blocked.

## Review

Packets are Markdown files or V3 packet folders in `.notch/outbox/`, `.notch/inbox/`, or `.notch/private/`. V1.1 adds an explicit agent-view command:

```bash
notch packet preview <packet-id>
```

Preview shows what an agent will read and re-runs the current scanner so upgraded patterns can warn on imported packets or packets written before newer scanner rules existed. Fresh local packet creation is already blocked by the same scanner before write.

## Preserve

Received packets in `.notch/inbox/` and `.notch/private/inbox/` are ground truth. For V3 artifact packets, the whole packet folder is the immutable unit: `packet.md`, `manifest.json`, and every file under `artifacts/` must continue to match the SHA-256 values in the packet and manifest. 3Notch refuses overwrite paths that would replace a received packet with different content. When context changes, author a new packet with `supersedes` or a typed reply with `replyTo`; do not mutate the imported packet folder.

## Honest Limits

- When an agent reads a packet, that packet content may be sent to the agent's LLM provider by the client.
- V3 does not encrypt records at rest. Use OS disk encryption and keep `.notch/private/` ignored.
- 3Notch is not a policy engine, DLP system, hosted audit platform, or remote sync service.
- The scanner is a guardrail, not a proof that content is safe.
