# Cross-Repo Handoff

Ask the source repo agent:

```text
Package the context the destination repo needs. Include source-linked facts, known constraints, explicit exclusions, the files the destination should work from, and the next steps the destination agent should take.
```

The agent should:

- Target the destination with recipient metadata (`--to-agent`, `--to-repo`).
- Carry actual files with `files` when the destination doesn't share your filesystem.
- Set `nextSteps` so the destination agent knows what to do with the packet.
- Use `includedSourceLinks` for file, commit, issue, URL, or record references.

Import from the destination:

```bash
notch packet import ../source/.notch/outbox/<packet-folder>/packet.md
notch packet preview <packet-id> --inbox
```

If the destination is on a different machine, the source instead packs:

```bash
notch packet pack <packet-id>
# move <packet-id>.notchpkt
notch packet unpack <packet-id>.notchpkt
```

Tools the agent uses:

- `create_packet` (accepts `files`, `refs`, `nextSteps`)
- `list_packets`, `get_packet`
- `import_packet`
- `get_brief`, `get_status`
