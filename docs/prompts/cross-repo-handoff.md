# Cross-Repo Handoff Prompt

Create a 3Notch packet for another local repo.

Use the current repo state and only explicitly selected context. Do not include raw chat history or unrelated files. Include source-linked facts, known constraints, and next steps.

Packet requirements:

- Target the destination with `toRepo`.
- Add `toAgent` when the destination agent is known.
- Include `sourceLinks` for files, commits, issues, or records used.
- Include exclusions for anything the destination should not infer.
- Keep the packet focused on the work that must cross the repo boundary.

Use `create_packet` through MCP or `notch packet create` through the CLI. When complete, give me the `.notch/outbox/` path so I can review and import it from the destination repo.
