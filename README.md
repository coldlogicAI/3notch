# 3Notch

**Your AI tools will change. Your project context should not have to.**

3Notch is a local-first CLI and MCP server for moving project context across boundaries that built-in AI tooling cannot cross: across repos, across AI work surfaces, and into new projects.

It stores explicit, reviewable Markdown/YAML records under `.notch/`. There is no cloud service, account, telemetry, vector database, hidden chat scraping, or remote connector in V1.x.

## Quickstart

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
notch brief
notch brief create
notch brief list
notch brief show <id>
notch packet create
notch packet import <file>
notch packet list
notch packet show <id>
notch packet preview <id>
notch seed from <repo-or-store-path>
notch scan <file-or-stdin>
notch status
notch doctor
notch mcp serve
```

## MCP

`notch mcp serve` exposes the V1 tools over local stdio MCP:

- `get_brief`, `create_brief`, `list_briefs`, `get_targeted_brief`
- `create_packet`, `import_packet`, `list_packets`, `get_packet`
- `create_seed_packet`, `import_seed_packet`
- `get_status`, `run_doctor`

Private records under `.notch/private/` are hidden unless the server starts with `--include-private`.

## Docs

- [Cross-repo packets](docs/cross-repo-packets.md)
- [Cross-tool handoff](docs/cross-tool-handoff.md)
- [Private context seeding](docs/private-context-seeding.md)
- [Targeted briefs](docs/targeted-brief-workflow.md)
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

## V1.x Boundaries

- Local-first files by default. No cloud dependency.
- No telemetry.
- No hidden chat/project scraping.
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
