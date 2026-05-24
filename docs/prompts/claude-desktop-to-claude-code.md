# Claude Desktop To Claude Code Packet Prompt

Ask Claude Desktop:

```text
Package the selected context from this conversation for Claude Code. Include a concise task summary, source labels, assumptions, exclusions, and recommended next steps. Use 3Notch so Claude Code can review the packet before working.
```

The agent should create a packet only from context you explicitly provide or summarize. It should not claim access to hidden chat history, project files, or external systems.

After creation, ask it to show the `.notch/outbox/` path and remind you to run:

```bash
notch packet preview <packet-id>
```

Agent tool reference:

- `create_packet`
- `list_packets`
- `get_packet`
- `get_status`
- `run_doctor`
