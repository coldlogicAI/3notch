# MCP Setup

3Notch V1 exposes a local stdio MCP server:

```bash
notch mcp serve
```

Use `notch onboard --mcp <client>` to print copy-pasteable setup guidance:

```bash
notch onboard --yes --mcp claude-desktop
```

## Useful Server Flags

```bash
notch mcp serve --read-only
notch mcp serve --include-private
notch mcp serve --store /path/to/project/.notch
notch mcp serve --default-actor "Claude Desktop"
```

Read-only mode rejects write tools. `--include-private` exposes `.notch/private/` records for that server process only.

## V1 MCP Tools

- `get_brief`, `create_brief`, `list_briefs`, `get_targeted_brief`
- `create_packet`, `import_packet`, `list_packets`, `get_packet`
- `create_seed_packet`, `import_seed_packet`
- `get_status`, `run_doctor`

There are no shell, chat scraping, remote connector, or deferred workflow tools in V1.
