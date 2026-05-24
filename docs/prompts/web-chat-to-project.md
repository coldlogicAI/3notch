# Web Chat To Project

Use this bridge when a web or desktop chat cannot call the local 3Notch MCP server.

## Flow

1. In your project terminal, print the bridge prompt:

```bash
notch prompt --client claude-chat
```

2. Paste the prompt into Claude.ai or another chat surface.
3. Talk normally. Give the chat only the context you want it to carry.
4. When you are done, ask:

```text
Give me a 3Notch packet for this project.
```

5. Copy the full packet the chat returns and import it into the local project:

```bash
pbpaste | notch packet import -
```

Linux:

```bash
xclip -selection clipboard -o | notch packet import -
```

PowerShell:

```powershell
Get-Clipboard | notch packet import -
```

## Contract

- The chat emits one Markdown/YAML packet with `purpose: seed`.
- The packet imports through the same schema validation, secret scan, audit log, and inbox write path as file imports.
- Stdin import is still explicit. 3Notch does not read browser state, chat history, or hidden project data.
- If the packet contains suspected secrets, import fails before writing.
