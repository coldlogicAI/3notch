# Cross-Tool Handoff

3Notch moves selected context between AI work surfaces by writing local packets. It does not inspect client databases, scrape chat history, or maintain a remote inbox.

There are four shapes of handoff. Pick the one that matches where the source and destination live.

## Same Store (one project, two tools)

For one project used from both Claude Code and Claude Desktop, point both clients at the same `.notch/` store:

```bash
notch onboard --yes --mcp claude-code
notch onboard --yes --mcp claude-desktop
```

When the source agent creates a packet through `create_packet`, the destination agent can read it through `list_packets` and `get_packet` immediately. No transfer step.

Conversational flow:

```text
Package this week's launch-context updates for Claude Desktop.
Include files used, assumptions, exclusions, and next steps.
```

Inspect before relying on it:

```bash
notch packet list --outbox
notch packet preview <packet-id>
```

## Cross-Repo (same machine, different repo)

The source creates an outbox packet; the destination imports it:

```bash
notch packet import ../source/.notch/outbox/<packet-folder>/packet.md
notch packet preview <packet-id> --inbox
```

If the destination needs the actual files (not just paths), use `--file` on the source side:

```bash
notch packet create --to-repo ../destination --file src/auth.ts --file docs/auth.md
```

See [cross-repo-packets.md](cross-repo-packets.md) for the full flow.

## Cross-Machine

Pack the folder into a deterministic `.notchpkt` archive, move it through any channel you already use (scp, rsync, iCloud, email, git LFS), and unpack on the other side:

```bash
notch packet pack <packet-id>
# move <packet-id>.notchpkt to the destination machine
notch packet unpack <packet-id>.notchpkt
```

`.notchpkt` is a gzipped tar with deterministic entry ordering. Hashes are re-verified at unpack against the manifest before anything lands in the inbox.

## Web-Chat (no local MCP)

For Claude.ai and other browser chats that can't reach a local MCP server, use the bridge prompt and stdin import:

```bash
notch prompt --client claude-chat
# paste the prompt into the chat; when done, ask for a packet
pbpaste | notch packet import -
```

See [../prompts/web-chat-to-project.md](../prompts/web-chat-to-project.md) for the full walkthrough.

## Rules Of The Road

- The source must hand over the context it wants stored. 3Notch does not derive it for you.
- Source links and exclusions belong in the packet, not as out-of-band conversation.
- Same-store handoff is fastest. Cross-repo and cross-machine require an explicit import.
- Inbox packets are immutable. To change context, author a successor with `--supersedes` or a typed reply with `notch reply`.
- Private seed records (`.notch/private/`) are hidden from MCP unless the server is started with `--include-private`.
