# Private Context Seeding

Private context seeding carries reviewed user preferences and workflow conventions from prior work into a new repo.

```bash
notch seed from ../old-project --review --include preferences --include workflow
notch packet list --private --purpose seed
```

Seed packets use `purpose: seed` and `sensitivity: private`. They are stored under `.notch/private/`, which `.notch/.gitignore` ignores by default.

`--review` writes a draft packet to a temp file and opens `$EDITOR`. Save a real edit before closing. Non-interactive runs without an editor are rejected with `NOTCH_SEED_REVIEW_REQUIRED`.

Use `--file <relative-path>` to carry selected source file references as links. V1 does not ingest file bodies during seeding.

## MCP Visibility

Private records are hidden from MCP by default:

```bash
notch mcp serve
```

Start MCP with explicit private access only when the current client should see private seed context:

```bash
notch mcp serve --include-private
```

## What Belongs Here

- User workflow preferences.
- Reusable conventions from prior projects.
- Lessons that were explicitly reviewed.

Do not put credentials, raw chat history, or unreviewed private material in seed packets.
