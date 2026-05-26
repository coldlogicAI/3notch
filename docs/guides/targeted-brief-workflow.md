# Targeted Brief Workflow

A targeted brief is scoped task context for a specific agent, feature, or workstream. Use briefs when the destination agent needs a compact, focused brief before work starts. Use packets when context needs to cross a repo or tool boundary.

## Create

```bash
notch brief create \
  --title "Schema implementation slice" \
  --to codex \
  --goal "Implement and verify the packet schema" \
  --topic schemas \
  --file src/schemas/packet.schema.json \
  --exclude "Do not add deferred commands"
```

`--goal` is the action; `--topic` is the area; `--file` records source links; `--exclude` calls out what the brief is deliberately not asking for.

## Read

```bash
notch brief             # the default project brief, if one exists
notch brief list        # all targeted briefs
notch brief show <id>   # one brief, full content
```

Briefs are stored under `.notch/briefs/` as human-readable Markdown with YAML frontmatter. They are read through the MCP tools `get_brief`, `list_briefs`, and `get_targeted_brief`.

## When To Use Briefs vs Packets

- **Brief**: scoped task context for an agent on the same store. No bytes travel. Lives in `.notch/briefs/`.
- **Packet**: cross-boundary context (cross-repo, cross-tool, cross-machine). May carry artifact bytes. Lives in `.notch/outbox/` and `.notch/inbox/`.

If the destination agent already shares the store, prefer a brief. If anything has to move between machines or stores, use a packet.
