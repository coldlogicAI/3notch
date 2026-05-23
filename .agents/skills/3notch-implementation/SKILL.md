# 3Notch Implementation

Use this skill when implementing 3Notch V1 features.

## Workflow

1. Read `3notch-v1-technical-spec.md` for authoritative architecture and V1 boundaries.
2. Read the relevant wave in `3notch-v1-implementation-plan.md`.
3. Keep the public product focused on agent handoff, not generic memory.
4. Implement the smallest useful CLI/core slice and test it.
5. Stop before adding hosted sync, telemetry, SQLite/native DB, semantic search, dashboards, or broad orchestration.

## Verification

Run:

```bash
npm run lint
npm run type-check
npm run build
npm test
```
