# Claude Desktop To Claude Code Packet Prompt

Create a 3Notch packet for Claude Code or Codex from the selected context in this conversation.

Use only context I explicitly provide or summarize here. Do not claim access to hidden chat history, project files, or external systems. Include:

- A concise summary of the task and current state.
- Source links or labels for the material used.
- Explicit exclusions and assumptions.
- Recommended next steps for the destination agent.

Call `create_packet` with:

- `title`: short handoff title.
- `summary`: selected context summary.
- `toAgent`: `claude-code` or `codex`.
- `sourceLinks`: reviewed links or labels when available.
- `importNotes`: what the destination agent should do and what it should not assume.

After the packet is created, show me the packet path and ask me to review it before import.
