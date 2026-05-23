# Baton Verification

Use this skill when validating Baton changes.

## Required Checks

```bash
npm run lint
npm run type-check
npm run build
npm test
node dist/cli/index.js --help
node dist/cli/index.js --version
```

## Review Points

- No telemetry, analytics, hosted sync, or unexpected network dependency.
- No SQLite/native DB, vector database, or semantic search dependency in V1.
- `.baton/` source records remain human-readable.
- Generated `dist/`, coverage, `.baton/index/`, and `.baton/logs/` output are ignored.
- Path handling changes reject traversal and out-of-project references.
