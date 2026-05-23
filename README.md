# 3Notch

When Claude stops, Codex starts with the right context.

3Notch is a local-first CLI and MCP server for passing project context between AI agents. It gives agents the same project brief, recent passes, active decisions, open questions, stale assumptions, and conflict warnings without sharing full private chat histories.

```bash
npx @3notch/cli onboard
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
- No telemetry or hosted dependency in V1.
- No SQLite or native database dependency in V1.
- Human-readable `.notch/` source files are the source of truth.
- Derived `.notch/index/` and `.notch/logs/` files must be rebuildable and are ignored by Git.

## License

MIT
