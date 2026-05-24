# 3Notch

**Your AI tools will change. Your project context should not have to.**

3Notch is a local-first CLI and MCP server for moving project context across boundaries that built-in AI tooling cannot cross: across repos, across AI work surfaces, and into new projects.

V1 ships three loops:

- Packet transfer between repos or tools.
- Private context seeding from prior work into a new repo.
- Targeted briefs for scoped agent work.

It stores explicit, reviewable Markdown/YAML records under `.notch/`. There is no cloud service, account, telemetry, vector database, hidden chat scraping, or remote connector in V1.

## Quickstart

From an installed package:

```bash
npx @3notch/cli onboard --yes --name source-app
npx @3notch/cli brief
npx @3notch/cli brief create --title "Marketing context" --to claude --goal "Draft launch copy from shipped repo state" --topic launch
npx @3notch/cli packet create --title "Current repo state" --summary "Checkout and admin settings changed." --to-agent claude --to-person marketing --file README.md
npx @3notch/cli status
npx @3notch/cli doctor --fix --yes
npx @3notch/cli mcp serve
```

From a fresh clone of this repository:

```bash
npm install
npm run build
WORKDIR="$(mktemp -d)"
mkdir -p "$WORKDIR/source-app" "$WORKDIR/destination-app" "$WORKDIR/old-project" "$WORKDIR/new-project"
node dist/cli/index.js --cwd "$WORKDIR/source-app" onboard --yes --name source-app
node dist/cli/index.js --cwd "$WORKDIR/destination-app" onboard --yes --name destination-app
node dist/cli/index.js --cwd "$WORKDIR/old-project" onboard --yes --name old-project
node dist/cli/index.js --cwd "$WORKDIR/new-project" onboard --yes --name new-project
node dist/cli/index.js --cwd "$WORKDIR/source-app" brief create --title "Marketing context" --to claude --goal "Draft launch copy from shipped repo state" --topic launch
PACKET="$(node dist/cli/index.js --cwd "$WORKDIR/source-app" --json packet create --title "Current repo state" --summary "Checkout and admin settings changed." --to-agent claude --to-repo "$WORKDIR/destination-app" --file README.md | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).outboxPath))")"
node dist/cli/index.js --cwd "$WORKDIR/destination-app" packet import "$PACKET"
node dist/cli/index.js --cwd "$WORKDIR/new-project" seed from "$WORKDIR/old-project" --review --file README.md
node dist/cli/index.js --cwd "$WORKDIR/destination-app" packet list --inbox
node dist/cli/index.js --cwd "$WORKDIR/new-project" packet list --private --purpose seed --inbox
node dist/cli/index.js --cwd "$WORKDIR/destination-app" doctor --fix --yes
```

The packet is a normal Markdown file in `.notch/outbox/`; importing it writes a reviewed copy to the destination `.notch/inbox/`.

`seed from --review` opens the generated seed packet in `$EDITOR`. Save a real edit before closing; non-interactive runs must set an editor command.

## How The Handoff Model Works

The loop is explicit and reviewable:

1. A user asks an AI client or CLI session to create a 3Notch packet from selected context.
2. The client supplies a summary, source links, exclusions, recipient metadata, and next steps through CLI or MCP.
3. 3Notch validates the record and writes a Markdown packet under `.notch/outbox/` or `.notch/private/`.
4. The user can inspect the packet before moving or importing it.
5. Another repo or tool imports the packet and reads it through CLI or MCP.

Targeting fields such as `--to-agent`, `--to-person`, and `--to-repo` answer "who is this packet for?" They are routing and review metadata in V1. They are not identity, authentication, or delivery controls.

## Core Commands

```bash
notch onboard
notch brief
notch brief create
notch brief list
notch brief show <id>
notch packet create
notch packet import <file>
notch packet list
notch packet show <id>
notch seed from <repo-or-store-path>
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

## Demo Fixtures

```bash
node dist/cli/index.js --cwd fixtures/cross-repo-demo/source-app doctor --fix --yes
node dist/cli/index.js --cwd fixtures/cross-repo-demo/destination-marketing doctor --fix --yes
node dist/cli/index.js --cwd fixtures/context-seed-demo/new-project doctor --fix --yes
node dist/cli/index.js --cwd fixtures/cross-repo-demo/destination-marketing packet list --inbox
```

The fixtures cover cross-repo handoff, private context seeding, and cross-tool packet creation from explicitly supplied session context.

## V1 Boundaries

- Local-first files by default. No cloud dependency in V1.
- No telemetry.
- No hidden chat/project scraping.
- No arbitrary shell execution through MCP.
- No SQLite or native database dependency.
- No `notch pass`, `notch send`, decision, question, conflict, or stale commands in V1.

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
