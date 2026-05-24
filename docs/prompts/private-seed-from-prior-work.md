# Private Seed From Prior Work Prompt

Create or import a private 3Notch seed packet from prior work into this repo.

Use this only for reviewed user preferences, workflow conventions, and lessons that should carry forward. Do not include credentials, raw chat history, or unreviewed private material.

Preferred CLI flow:

```bash
notch seed from <old-repo-or-store-path> --review
```

Preferred MCP flow:

- Use `create_seed_packet` only for reviewed private context I explicitly provide.
- Use `import_seed_packet` only for a packet path I explicitly choose.
- Keep the packet under `.notch/private/`.

After import, confirm that the seed is private and remind me that MCP will not expose it unless the server starts with `--include-private`.
