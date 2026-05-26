# 3Notch

**Your AI tools will change. Your project context should not have to.**

You are already the bus for your AI context: copying summaries between Claude, Codex, Cursor, ChatGPT, terminals, repos, and new projects. 3Notch is the local packet layer for the context you meant to carry by hand.

3Notch is a local-first CLI and MCP server for moving explicit, reviewable Markdown/YAML records under `.notch/`. There is no cloud service, account, telemetry, vector database, hidden chat scraping, semantic indexing, or remote connector in V2.

## Quickstart

### 1. Same-Store Cross-Tool

For a project you use from both Claude Code and Claude Desktop, point both clients at the same `.notch/` store:

```bash
npx @3notch/cli onboard --yes --mcp claude-code
npx @3notch/cli onboard --yes --mcp claude-desktop
```

Then ask your agent naturally:

```text
Package this repo's current release context for Claude Desktop. Include the files you used, the constraints, and next steps.
```

The agent uses the 3Notch MCP tools to create a packet in `.notch/outbox/`. Because both clients use the same store, the other client can list and read that packet immediately.

Inspect the packet before relying on it:

```bash
notch packet list --outbox
notch packet preview <packet-id>
```

### 2. Cross-Repo Packet

When the destination is a different repo, create an outbox packet in the source and import it in the destination:

```bash
notch packet create --title "Auth handoff" --summary "Auth context for the API repo." --to-agent codex --to-repo ../api --file src/auth.ts
notch packet import ../source/.notch/outbox/<packet-file>.md
```

### Fallback: Web Chats Without MCP

Claude.ai and other browser-only chats cannot reach local MCP tools today. In that case 3Notch falls back to a clipboard-mediated text ingest — print the bridge prompt, paste it into the chat, ask for a packet, copy the result, then pipe stdin:

```bash
notch prompt --client claude-chat
pbpaste | notch packet import -
```

This is an escape hatch, not a peer of the MCP-native paths above. The structurally honest replacement is custom connectors / remote MCP — see [Where We Want Help](#where-we-want-help).

Use `notch mark` when you just want to remember something for yourself:

```bash
notch mark --summary "Decided to keep browser auth cookie-based" --tags auth
notch check
```

For clients that are not auto-configured yet, print setup instructions and an agent prompt pack:

```bash
notch onboard --yes --mcp codex
notch prompt --client codex
```

From a fresh clone of this repository:

```bash
npm install
npm run build
WORKDIR="$(mktemp -d)"
mkdir -p "$WORKDIR/source-app" "$WORKDIR/destination-app"
node dist/cli/index.js --cwd "$WORKDIR/source-app" onboard --yes --name source-app
node dist/cli/index.js --cwd "$WORKDIR/destination-app" onboard --yes --name destination-app
PACKET="$(node dist/cli/index.js --cwd "$WORKDIR/source-app" --json packet create --title "Current repo state" --summary "Checkout and admin settings changed." --to-agent claude --to-repo "$WORKDIR/destination-app" --file README.md | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).outboxPath))")"
node dist/cli/index.js --cwd "$WORKDIR/source-app" packet preview "$(basename "$PACKET" .md)" --outbox
node dist/cli/index.js --cwd "$WORKDIR/destination-app" packet import "$PACKET"
node dist/cli/index.js --cwd "$WORKDIR/destination-app" packet list --inbox
```

## How The Handoff Model Works

The loop is explicit and reviewable:

1. A user asks an AI client or CLI session to package selected context.
2. The client supplies a summary, source links, exclusions, recipient metadata, and next steps through CLI or MCP.
3. 3Notch validates the record and writes a Markdown packet under `.notch/outbox/` or `.notch/private/`.
4. The user previews the packet before another tool or repo relies on it.
5. Another repo can import the packet, or another tool can read it directly when both clients share the same store.

Targeting fields such as `--to-agent`, `--to-person`, and `--to-repo` answer "who is this packet for?" They are routing and review metadata in V1.x. They are not identity, authentication, or delivery controls.

## Core Commands

```bash
notch onboard
notch prompt --client <client>
notch mark
notch reply <id>
notch brief
notch brief create
notch brief list
notch brief show <id>
notch packet create
notch packet import <file>
notch packet import -
notch packet list
notch packet show <id>
notch packet preview <id>
notch seed from <repo-or-store-path>
notch scan <file-or-stdin>
notch status
notch check
notch doctor
notch mcp serve
```

## MCP

`notch mcp serve` exposes the shipped tools over local stdio MCP:

- `get_brief`, `create_brief`, `list_briefs`, `get_targeted_brief`
- `create_packet`, `import_packet`, `list_packets`, `get_packet`
- `create_seed_packet`, `import_seed_packet`
- `create_mark`, `create_reply`, `check_store`
- `get_status`, `run_doctor`

Private records under `.notch/private/` are hidden unless the server starts with `--include-private`.

## Docs

- [Cross-repo packets](docs/cross-repo-packets.md)
- [Cross-tool handoff](docs/cross-tool-handoff.md)
- [Private context seeding](docs/private-context-seeding.md)
- [Targeted briefs](docs/targeted-brief-workflow.md)
- [Web-chat to project bridge](docs/prompts/web-chat-to-project.md)
- [MCP setup](docs/mcp-setup.md)
- [Privacy and security](docs/privacy.md)
- [Security story](docs/security-story.md)

## Demo Fixtures

```bash
node dist/cli/index.js --cwd fixtures/cross-repo-demo/source-app doctor --fix --yes
node dist/cli/index.js --cwd fixtures/cross-repo-demo/destination-marketing doctor --fix --yes
node dist/cli/index.js --cwd fixtures/context-seed-demo/new-project doctor --fix --yes
node dist/cli/index.js --cwd fixtures/cross-repo-demo/destination-marketing packet list --inbox
```

The fixtures cover cross-repo handoff, private context seeding, and cross-tool packet creation from explicitly supplied session context.

## Where We Want Help

3Notch is open source because the cross-vendor handoff problem can only be solved neutrally. The list below is the set of known gaps and adjacent surfaces where we want contributor input. It is not exhaustive — propose additions via issue or PR.

**Reaching more surfaces**

- **Web-chat ingest via custom connectors / remote MCP.** The clipboard fallback above exists because browser chats can't reach local MCP. The structurally honest fix is shipping an optional HTTP/SSE MCP mode that a user wires to Claude.ai (or any connector-capable surface) via Anthropic's custom-connector flow plus a user-controlled tunnel (Tailscale, Cloudflare). No hosted relay required.
- **Onboarding for additional clients** beyond the V2 set — Gemini CLI, other MCP-capable agents, future surfaces.
- **Mobile / voice intake** — surface bridges for the cases that aren't a desktop terminal.
- **Claude Code → web-chat sharing** (the reverse direction of the current bridge).

**Moving packets between machines and people**

- **Cross-machine transport recipes** — opinionated adapter docs and scripts for Tailscale, iCloud, Syncthing, git-based, scp/rsync. 3Notch will not ship its own transport; community recipes are the right layer.
- **Cross-user / teammate workflows** — conventions and adapter docs for handing packets to a teammate over whatever channel a team already uses.

**Distribution polish**

- **DXT packaging for Claude Desktop** (one-click MCP install).
- **Notarized / signed installers** across operating systems.

**Capture ergonomics**

- **Agent prompt packs / skills** that wrap the "save artifact to disk, then create_packet" sequence for specific clients.
- **Per-language / per-framework brief templates.**

**Surfaces on top of the stable substrate**

- **Reply-surfacing UX patterns.** V2 shipped the schema primitives (`replyTo`, `replyType`, `status`); the surfacing layer is deliberately deferred so contributors can experiment with what their agent and workflow actually want.
- **Wiki / browse / graph views over `relationships.json`.** Out of OSS core scope by design, but contributor surfaces over the stable substrate are welcome.
- **Additional `notch check` rules.** Stale open replies, broken source-links, tag drift, orphan detection — contribute when you've hit the pain rather than speculatively.

**Hardening**

- **Encryption at rest for `.notch/private/`** — forward-committed since V1.1, deferred again in V2.
- **Scanner rule contributions** — org-specific, industry-specific, or platform-specific secret/PII patterns.

If you're considering a contribution that fits one of these, open an issue first so we can align on the boundary between OSS core and contributor ecosystem.

## V2 Boundaries

- Local-first files by default. No cloud dependency.
- No telemetry.
- No hidden chat/project scraping.
- No semantic derivation, auto-tagging, similarity threading, contradiction flagging, wiki UI, graph view, hosted sync, or cross-store aggregation.
- No arbitrary shell execution through MCP.
- No SQLite or native database dependency.
- No `notch pass`, `notch send`, decision, question, conflict, or stale commands.

## Development

```bash
npm install
npm run lint
npm run type-check
npm run build
npm test
npm run test:e2e
node dist/cli/index.js --help
node dist/cli/index.js --version
```

## License

MIT
