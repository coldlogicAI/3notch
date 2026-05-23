# Contributing

Thanks for helping make 3Notch useful.

## Development Setup

```bash
npm install
npm run lint
npm run type-check
npm run build
npm test
```

## Scope

3Notch V1 is a local-first CLI and MCP server for passing project context between AI agents. Keep changes aligned with the V1 spec and implementation plan.

Avoid adding hosted services, telemetry, native databases, semantic search dependencies, dashboards, or broad agent orchestration before the V1 handoff workflow is working.

## Pull Requests

- Keep changes small and reviewable.
- Add or update tests for behavior changes.
- Preserve human-readable `.notch/` source records.
- Do not commit generated output from `dist/`, `coverage/`, `.notch/index/`, or `.notch/logs/`.
