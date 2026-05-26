# MCP Setup

3Notch exposes a local stdio MCP server. Start it from the project root:

```bash
notch mcp serve
```

For client-specific setup snippets, run:

```bash
notch onboard --yes --mcp claude-code
notch onboard --yes --mcp claude-desktop
notch onboard --yes --mcp codex
notch onboard --yes --mcp cursor
```

`notch onboard --mcp claude-code` writes a project-local `.mcp.json`. `notch onboard --mcp claude-desktop` updates `~/Library/Application Support/Claude/claude_desktop_config.json` with a backup. Other clients print copy-paste snippets.

## Server Flags

```bash
notch mcp serve --read-only           # reject write tools
notch mcp serve --include-private     # expose .notch/private/ for this server only
notch mcp serve --store /path/.notch  # point at a non-default store
notch mcp serve --default-actor "Claude Desktop"
```

## Available Tools

Read-only:

- `get_brief`, `list_briefs`, `get_targeted_brief`
- `get_packet`, `list_packets`
- `get_status`, `check_store`, `run_doctor`

Write tools (require client tool-permission grant):

- `create_brief`
- `create_packet` (accepts `files`, `refs`, and `nextSteps`)
- `create_mark` — self-addressed private capture
- `create_reply` — typed packet reply
- `create_seed_packet`
- `import_packet`, `import_seed_packet`

There are no shell-execution, chat-scraping, remote-connector, or background-collection tools. Any tool name not in this list does not exist.

## Agent Instruction Packs

```bash
notch prompt --client claude-code
notch prompt --client claude-desktop
notch prompt --client codex
notch prompt --client cursor
notch prompt --client claude-chat   # web-chat bridge
```

These print agent instructions you paste into `CLAUDE.md`, `AGENTS.md`, or the client's system prompt. They tell the agent when to use which tool, with `nextSteps` and source links as first-class fields.
