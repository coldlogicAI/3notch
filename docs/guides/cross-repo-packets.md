# Cross-Repo Packets

A packet is a reviewable Markdown record (and, when needed, an artifact bundle) that one repo creates and another imports. It is the main 3Notch flow.

## Create

```bash
notch packet create \
  --title "Brand handoff" \
  --summary "Launch-page context for the brand repo." \
  --to-agent codex \
  --to-repo ../brand-site \
  --file mascot.jpg:asset \
  --file showcase.html:source \
  --next-steps "Build apps/brand-site/ using showcase.html as the layout and mascot.jpg in the hero."
```

The packet is written to `.notch/outbox/`. When `--file` is used, it lands as a folder containing `packet.md`, `manifest.json`, and copied bytes under `artifacts/`, preserving each file's project-relative path. Without `--file`, it lands as a single `.md` file.

Recipient fields (`--to-agent`, `--to-person`, `--to-repo`) label intent. They do not authenticate or deliver anything — local filesystems and your own transport (scp, rsync, iCloud, Tailscale, email, git) move the bytes.

## File vs Reference

- `--file <path>` copies the file's bytes into the packet's `artifacts/` directory, preserves its project-relative path, and records a SHA-256 hash. Use this when the receiver does not share your filesystem.
- `--ref <path>` records a pointer only. Use this when the receiver shares the same workspace path (sibling repo on the same machine).

Append `:asset`, `:source`, `:reference`, or `:output` to a `--file` arg to tag its purpose. Default is `asset`; when unsure, omit the suffix. Common human labels like `:favicon`, `:icon`, `:logo`, `:image`, and `:screenshot` are accepted as `asset`.

## Preview Before Import

```bash
notch packet preview <packet-id>
```

Preview shows the agent-visible content plus an artifact table (path, short SHA-256, byte size) and re-runs the scanner against the markdown so newer rules can flag older packets.

## Import

```bash
notch packet import ../source/.notch/outbox/<packet-folder>/packet.md
notch packet list --inbox
notch packet show <packet-id> --inbox
```

Import writes a copy to `.notch/inbox/`. If the source is a packet folder, every artifact is re-hashed against `manifest.json` and the packet's frontmatter; a mismatch raises `NOTCH_ARTIFACT_HASH_MISMATCH` and nothing lands in the inbox.

Imported packet folders are sealed. To change context, author a successor with `--supersedes <id>` or a typed reply with `notch reply`. Never edit an inbox packet in place.

Replying to an imported project handoff writes a new project packet to your
`.notch/outbox/` and targets the parent packet's origin project by default. Move
or pack that reply through the same explicit transport used for the original
handoff. Replies to private seed context remain under `.notch/private/`.

## Cross-Machine

When the destination is on a different machine, pack the folder into a deterministic `.notchpkt` archive, move it through any channel you already use, and unpack on the other side:

```bash
notch packet pack <packet-id>          # → <packet-id>.notchpkt in $CWD
notch packet unpack <packet-id>.notchpkt
```

`--output -` writes the archive to stdout for piping; `notch packet unpack -` reads from stdin.

## Review Habits

- Run `notch packet preview <id>` before relying on an imported packet.
- Keep `--summary` honest about what was reviewed vs. what was assumed.
- Use `includedSourceLinks` and `--file` to identify exactly what claims were based on.
- Run `notch doctor` after import to validate records and rebuild derived indexes.
