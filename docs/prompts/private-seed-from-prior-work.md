# Private Seed From Prior Work

Ask the agent:

```text
Create a private 3Notch seed packet from the reviewed workflow conventions and user preferences I provide here. Keep it limited to context that should carry forward into this repo.
```

Only for reviewed preferences, conventions, and lessons. Do not include credentials, raw chat history, or unreviewed private material.

CLI flow (preferred):

```bash
notch seed from <old-repo-or-store-path> --review --include preferences --include workflow
```

`--review` opens the draft in `$EDITOR`. Save a real edit before closing. Non-interactive runs without an editor are rejected.

Tools the agent uses:

- `create_seed_packet`
- `import_seed_packet`
- `list_packets`, `get_packet`

After import, confirm the seed is private and that MCP will not expose it unless the server is started with `--include-private`.
