# Cross-Tool Handoff

3Notch moves selected context between AI work surfaces by writing local packets. It does not inspect hidden client databases or scrape chat history.

## Default Setup: Same Store

For one project used from Claude Code and Claude Desktop, point both MCP clients at the same project store:

```bash
notch onboard --yes --mcp claude-code
notch onboard --yes --mcp claude-desktop
```

Both clients now read and write the same `.notch/` directory. When Claude Code creates a packet in `.notch/outbox/`, Claude Desktop can list and read it from that same store. No file transfer or import step is needed inside one project.

## Conversational Flow

Ask the source agent for the outcome:

```text
Package this week's launch-context updates for Claude Desktop. Include the files used, assumptions, exclusions, and next steps.
```

The agent should use `create_packet` through MCP with selected context and source links. Review the result:

```bash
notch packet list --outbox
notch packet preview <packet-id>
```

## Cross-Repo Flow

When the destination is a different repo, keep the explicit import step:

```bash
notch packet import ../source/.notch/outbox/<packet-file>.md
```

The packet is portable context, not a live connection to the source tool. The destination agent should rely only on the packet content, source links, exclusions, and next steps.

## Rules Of The Road

- The client must supply the context it wants stored.
- Source links and exclusions should be explicit.
- Same-store handoff is best for one project across two tools.
- Cross-repo handoff still uses packet import.
- Private seed context is unavailable through MCP unless `--include-private` is used.
