# 3Notch

When work moves repos, the right context moves with it.

3Notch is a local-first CLI and MCP server for passing project context across repos and AI agents. It packages the useful parts of a repo's context into inspectable packets so the next repo, person, or agent can continue without copy-paste or full chat-history sharing.

V1 target flow:

```bash
npx @3notch/cli onboard
notch packet create --to-agent codex --to-repo ../api
notch packet import ../web-app/.notch/outbox/<packet-file>.md
notch send --to ../api
notch brief
notch pass
notch mcp serve
```

## Status

3Notch is in bootstrap stage. This repository currently contains the V1 planning docs, project workflow guidance, and a small runnable CLI skeleton for `notch --help` and `notch --version`.

The full V1 command set is intentionally not implemented yet. Start future implementation work with:

- [`3notch-v1-technical-spec.md`](3notch-v1-technical-spec.md)
- [`3notch-v1-implementation-plan.md`](3notch-v1-implementation-plan.md)
- [`3notch-project-request.md`](3notch-project-request.md)
- [`3notch-branding-review.md`](3notch-branding-review.md)

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
- No telemetry or hosted dependency in V1.
- No SQLite or native database dependency in V1.
- Human-readable `.notch/` source files are the source of truth.
- Created packets live in `.notch/outbox/`; imported packets live in `.notch/inbox/`.
- Derived `.notch/index/` and `.notch/logs/` files must be rebuildable and are ignored by Git.

## License

MIT
