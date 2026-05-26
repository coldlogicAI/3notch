# Claude Desktop To Claude Code

Ask Claude Desktop:

```text
Package the selected context from this conversation for Claude Code. Include a concise task summary, source labels, assumptions, exclusions, and recommended next steps. Carry any referenced files as artifacts. Use 3Notch so Claude Code can review the packet before working.
```

The agent should:

- Create the packet only from context you explicitly provided or summarized.
- Set `nextSteps` to a short, imperative description of what Claude Code should do.
- Use `files` for bytes that need to travel; use `refs` only for paths both tools share.
- Avoid claims about hidden chat history, project files, or external systems.

After creation, ask for the outbox path and run:

```bash
notch packet preview <packet-id>
```

Tools the agent uses:

- `create_packet` (accepts `files`, `refs`, `nextSteps`)
- `list_packets`, `get_packet`
- `get_status`, `run_doctor`
