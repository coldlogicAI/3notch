# Baton

When Claude stops, Codex starts with the right context.

Baton is a local-first CLI and MCP server for passing project context between AI agents. It gives agents the same project brief, recent passes, active decisions, open questions, stale assumptions, and conflict warnings without sharing full private chat histories.

```bash
npx baton onboard
baton brief
baton pass
baton mcp serve
```

## Status

Baton is in bootstrap stage. This repository currently contains the V1 planning docs, project workflow guidance, and a small runnable CLI skeleton for `baton --help` and `baton --version`.

The full V1 command set is intentionally not implemented yet. Start future implementation work with:

- [`baton-v1-technical-spec.md`](baton-v1-technical-spec.md)
- [`baton-v1-implementation-plan.md`](baton-v1-implementation-plan.md)
- [`baton-project-request.md`](baton-project-request.md)
- [`baton-branding-review.md`](baton-branding-review.md)

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
- Human-readable `.baton/` source files are the source of truth.
- Derived `.baton/index/` and `.baton/logs/` files must be rebuildable and are ignored by Git.

## License

MIT
