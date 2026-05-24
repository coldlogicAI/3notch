# Cross-Repo Handoff Prompt

Ask the source repo agent:

```text
Package the context needed by the destination repo. Include source-linked facts, known constraints, explicit exclusions, and the next steps the destination agent should take.
```

The agent should keep the packet focused on the work that must cross the repo boundary. It should target the destination with recipient metadata and include file, commit, issue, URL, or record links when available.

When complete, import from the destination repo:

```bash
notch packet import ../source/.notch/outbox/<packet-file>.md
notch packet preview <packet-id> --inbox
```

Agent tool reference:

- `create_packet`
- `list_packets`
- `get_packet`
- `import_packet`
- `get_brief`
- `get_status`
