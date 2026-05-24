# Targeted Brief Workflow

Targeted briefs are scoped task context for a specific agent, feature, or workstream.

```bash
notch brief create \
  --title "Schema implementation slice" \
  --to codex \
  --goal "Implement and verify the packet schema" \
  --topic schemas \
  --file README.md \
  --exclude "Do not add deferred commands"
```

Use them when the destination agent needs a compact brief before work starts. Use packets when context needs to cross a repo or tool boundary.

## Commands

```bash
notch brief
notch brief create --title "..." --to codex --goal "..."
notch brief list
notch brief show <id>
```

Briefs are stored under `.notch/briefs/` and remain human-readable Markdown/YAML.
