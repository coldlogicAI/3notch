# 3Notch Verification

Use this skill when validating 3Notch changes.

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
- Cross-repo packet behavior uses `.notch/outbox/` for created packets and `.notch/inbox/` for imported packets.
- Cross-tool handoff behavior is explicit: MCP tools write/read supplied packets and never scrape private chat or project data behind the user's back.
- Imported packets remain inspectable and are not silently merged into destination records.
- Private seed packets use ignored `.notch/private/` storage and are not exposed through MCP without explicit private-context enablement.
- `.notch/` source records remain human-readable.
- Generated `dist/`, coverage, `.notch/index/`, and `.notch/logs/` output are ignored.
- Path handling changes reject traversal and out-of-project references.
