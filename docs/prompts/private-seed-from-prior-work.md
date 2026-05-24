# Private Seed From Prior Work Prompt

Ask the agent:

```text
Create a private 3Notch seed packet from the reviewed workflow conventions and user preferences I provide here. Keep it limited to context that should carry forward into this repo.
```

Use this only for reviewed user preferences, workflow conventions, and lessons from prior work. Do not include credentials, raw chat history, or unreviewed private material.

Preferred CLI flow:

```bash
notch seed from <old-repo-or-store-path> --review --include preferences --include workflow
```

The CLI opens the draft seed packet in `$EDITOR`; save a real edit before import.

Agent tool reference:

- `create_seed_packet`
- `import_seed_packet`
- `list_packets`
- `get_packet`

After import, confirm that the seed is private and that MCP will not expose it unless the server starts with `--include-private`.
