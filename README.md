# 3Notch

**Your AI tools will change. Your project context shouldn't have to.**

3Notch is a local-first CLI and MCP server for moving project context across boundaries that built-in AI tooling cannot cross — across repos, across AI work surfaces (Claude Desktop, Claude Code, Codex, Cursor, ChatGPT), and across the start of new projects.

It packages selected, source-linked context into inspectable Markdown packets that another repo or tool can import. No copy-paste. No full chat-history sharing. No vendor lock-in.

## The killer demo

You're writing marketing copy in Claude Desktop. The copy depends on what actually shipped in the repo — Claude Code knows the repo, Claude Desktop doesn't. Without 3Notch you copy-paste back and forth and the marketing drifts out of date.

With 3Notch:

1. In Claude Code, ask the agent to create a packet from current repo state.
2. The agent calls `create_packet` with a summary, links to relevant files, and exclusions.
3. The packet lands in `.notch/outbox/` as a reviewable Markdown file.
4. In Claude Desktop, ask the agent to import the packet (or pass it via the CLI).
5. Marketing copy stays grounded in what actually shipped.

The same loop works for any cross-boundary handoff: planning repo → implementation repo, contractor → in-house team, Claude Desktop → Codex CLI, prior project → new project.

## V1 target flow

```bash
npx @3notch/cli onboard
notch seed from ../old-project --include preferences --include workflow --review
notch packet create --to-agent claude --to-person marketing --summary "Current shipped features and constraints"
notch packet import ../source-app/.notch/outbox/<packet-file>.md
notch brief
notch status
notch mcp serve --include-private
```

## Status

3Notch is in bootstrap. This repository currently contains V1 planning docs, contributor scaffolding, and a runnable CLI skeleton for `notch --help` and `notch --version`. The full command set is not yet implemented.

Start future implementation work with:

- [`docs/3notch-v1-technical-spec.md`](docs/3notch-v1-technical-spec.md)
- [`docs/3notch-v1-implementation-plan.md`](docs/3notch-v1-implementation-plan.md)
- [`docs/3notch-project-request.md`](docs/3notch-project-request.md)
- [`docs/3notch-branding-review.md`](docs/3notch-branding-review.md)

## How the handoff model works

The loop is explicit and reviewable:

1. A user asks an AI work surface to create a 3Notch packet from selected project/session context.
2. The agent calls a local 3Notch MCP tool and supplies the selected or summarized context.
3. 3Notch writes a local packet under `.notch/outbox/` or `.notch/private/`.
4. The user can inspect the packet before moving it.
5. Another repo or tool imports the packet and reads it through CLI or MCP.

V1 implements the local CLI plus local MCP loop. A Claude Desktop DXT package is the likely later packaging layer for easier local install. Remote connectors are a later hosted path with a different trust model.

## Why a third party

Incumbents have a structural anti-incentive to make context portable. Anthropic will not ship "easily move your context to Codex." OpenAI will not ship "easily move to Claude." Cursor will not ship "easily move to Windsurf." A vendor-neutral, locally-owned packet format is the only place this problem can be solved.

## Development

```bash
npm install
npm run lint
npm run type-check
npm run build
npm test
node dist/cli/index.js --help
```

## V1 boundaries

- Local-first by default. No cloud dependency in V1.
- Cross-repo packets are a V1 core feature, not a later export.
- Private context seeding is a V1 core feature.
- Cross-tool handoff is the product direction.
- No telemetry.
- No hidden chat or project scraping. Agents and users supply selected context to 3Notch through CLI or MCP.
- No SQLite or native database dependency in V1.
- Human-readable `.notch/` source files are the source of truth.
- Created packets live in `.notch/outbox/`; imported packets live in `.notch/inbox/`.
- Private seed packets live in `.notch/private/` and are ignored by Git by default.
- Derived `.notch/index/` and `.notch/logs/` files are rebuildable and ignored by Git.
- No session-end pass workflow, decision records, open question records, conflict records, or stale-marking commands in V1. Same-repo same-session continuity is solved by CLAUDE.md, native tool memory, and `git commit`. 3Notch focuses on what those tools cannot do: cross-boundary transport.

## License

MIT
