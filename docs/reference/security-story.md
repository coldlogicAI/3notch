# Security Story

3Notch's security model is concrete: **curate, scan, audit, review, preserve.** Each step is mechanical and inspectable.

## Curate

3Notch stores context a human, agent, or explicitly installed lifecycle hook supplies. It does not scrape hidden chat databases, open Claude transcript paths, scan arbitrary project history, or run a daemon. Hook fallbacks whitelist documented event fields and Git metadata; source links should identify where claims came from without copying unnecessary content.

## Scan

Writes are checked before records are stored. The scanner catches:

- Configured sensitive-word patterns (defaults: `api_key`, `secret`, `password`, `token`).
- JWT-like strings.
- SSH/private-key markers.
- Known access-token formats (GitHub PAT, npm token, Stripe key, Slack token, GitLab PAT).
- High-entropy token-like strings.

The scanner also runs over the bytes of text-like packet artifacts (`.md`, `.html`, source files, `.json`, `.yaml`, `.svg`, etc.) before they are copied into a bundle. Binary artifacts (`.jpg`, `.png`, etc.) are skipped by design and the skip is recorded in `.notch/logs/audit.jsonl`.

Direct scanner access:

```bash
notch scan README.md
pbpaste | notch scan -
```

The scanner intentionally blocks some benign documentation prose. When that happens, the error includes file or field context, a line excerpt, and a rephrase suggestion.

## Audit

Every successful write, blocked write, and skipped artifact scan appends a line to `.notch/logs/audit.jsonl`. The log is local and gitignored, but it gives evidence that a record was created, imported, blocked, or skipped — with timestamps, actor resolution, and source-tool attribution.

## Review

Packets are Markdown files or packet folders in `.notch/outbox/`, `.notch/inbox/`, or `.notch/private/`. The preview command surfaces what an agent will read:

```bash
notch packet preview <packet-id>
```

Preview re-runs the current scanner against the markdown so newer rules can warn on packets created before those rules existed. It also prints the artifact table (path, short SHA-256, byte size) so you can see what bytes will travel with the packet.

## Preserve

Received packets are ground truth.

- A single-file packet's markdown content is content-hash-checked before any overwrite is permitted.
- A packet folder is the immutable unit: `packet.md`, `manifest.json`, and every file under `artifacts/` must continue to match the SHA-256 values recorded in the packet's frontmatter and manifest.
- Hash mismatches at import raise `NOTCH_ARTIFACT_HASH_MISMATCH` and abort before any inbox state is written.

When context changes, author a successor packet with `--supersedes <id>` or a typed reply with `notch reply`. Do not mutate an imported packet.

Continuation checkpoints follow the same rule: each stream is an immutable `supersedes` chain, and automatic fallbacks remain unreviewed until a human confirms them.

## Honest Limits

- When an agent reads a packet, the content may be sent to that agent's LLM provider by the client.
- 3Notch does not encrypt records at rest. Use OS disk encryption and keep `.notch/private/` gitignored.
- The scanner is a guardrail, not a proof that content is safe.
- Bundle integrity is verified by SHA-256 hashing, not signing. Anyone with write access to a `.notchpkt` archive can produce a valid-looking bundle. Hashing proves bytes did not change in transit; it does not prove who authored them.
- 3Notch is not a policy engine, DLP system, hosted audit platform, or remote sync service.
