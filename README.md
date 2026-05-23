# 3Notch

When work moves repos, the right context moves with it.

3Notch is a local-first CLI and MCP server for passing project and private workflow context across repos, Claude Desktop, Claude Code, Codex, and other AI work surfaces. It packages the useful parts of prior work into inspectable packets so a new repo, person, or agent can continue without copy-paste or full chat-history sharing.

V1 target flow:

```bash
npx @3notch/cli onboard
notch seed from ../old-project --include preferences --include workflow --review
notch packet create --to-agent codex --to-repo ../api
notch packet import ../web-app/.notch/outbox/<packet-file>.md
notch send --to ../api
notch brief
notch pass
notch mcp serve --include-private
```

## Status

3Notch is in bootstrap stage. This repository currently contains the V1 planning docs, project workflow guidance, and a small runnable CLI skeleton for `notch --help` and `notch --version`.

The full V1 command set is intentionally not implemented yet. Start future implementation work with:

- [`3notch-v1-technical-spec.md`](3notch-v1-technical-spec.md)
- [`3notch-v1-implementation-plan.md`](3notch-v1-implementation-plan.md)
- [`3notch-project-request.md`](3notch-project-request.md)
- [`3notch-branding-review.md`](3notch-branding-review.md)

## Handoff Model

The product is not a hidden chat archive. The intended loop is explicit and reviewable:

1. A user asks an AI work surface, such as Claude Desktop, to create a 3Notch packet from the current project/session context.
2. The agent calls a local 3Notch MCP tool and supplies selected or summarized context.
3. 3Notch writes a local packet under `.notch/outbox/` or `.notch/private/`.
4. The user can inspect the packet before moving it.
5. Another repo or tool imports the packet and reads it through CLI or MCP.

V1 should implement the local CLI plus local MCP loop. A Claude Desktop DXT package is the likely later packaging layer for easier local install. Remote connectors are a later hosted path, not the privacy-first V1 default.

## Development

```bash
npm install
npm run lint
npm run type-check
npm run build
npm test
node dist/cli/index.js --help
```

## V1 Boundaries

- Local-first by default.
- Cross-repo packets are a V1 core feature, not a later export feature.
- Private context seeding is a V1 core feature for carrying user preferences and workflow conventions into new repos.
- Cross-tool handoff is the core product direction: Claude Desktop, Claude Code, Codex, Cursor, ChatGPT, and local agents should be able to exchange context through explicit packets.
- No telemetry or hosted dependency in V1.
- No hidden chat/project scraping. Agents and users supply selected context to 3Notch through CLI or MCP.
- No SQLite or native database dependency in V1.
- Human-readable `.notch/` source files are the source of truth.
- Created packets live in `.notch/outbox/`; imported packets live in `.notch/inbox/`.
- Private seed packets live in `.notch/private/` and are ignored by Git by default.
- Derived `.notch/index/` and `.notch/logs/` files must be rebuildable and are ignored by Git.

## License

MIT
