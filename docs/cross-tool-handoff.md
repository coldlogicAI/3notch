# Cross-Tool Handoff

3Notch moves selected context between AI work surfaces by writing local packets. It does not inspect hidden client databases or scrape chat history.

Example: Claude Desktop has product discussion context, while Codex has repo access. The user asks Claude Desktop to create a scoped packet through MCP. Codex imports that packet and uses only the supplied summary, source links, exclusions, and next steps.

## MCP Flow

1. Start the local server in the source workspace:

   ```bash
   notch mcp serve
   ```

2. Ask the source AI client to call `create_packet` with selected context.
3. Review the Markdown packet in `.notch/outbox/`.
4. Move or reference the packet path from the destination repo:

   ```bash
   notch packet import ../source/.notch/outbox/<packet-file>.md
   ```

## Rules Of The Road

- The client must supply the context it wants stored.
- Source links and exclusions should be explicit.
- A packet is portable context, not a live connection to the source tool.
- Private seed context is unavailable through MCP unless `--include-private` is used.
