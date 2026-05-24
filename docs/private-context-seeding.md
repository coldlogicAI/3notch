# Private Context Seeding

Private context seeding carries reviewed user preferences and workflow conventions from prior work into a new repo.

```bash
notch seed from ../old-project --review --include preferences --include workflow
notch packet list --private --purpose seed
```

Seed packets use `purpose: seed` and `sensitivity: private`. They are stored under `.notch/private/`, which `.notch/.gitignore` ignores by default.

`--review` writes a draft packet to a temp file and opens `$EDITOR`. Save a real edit before closing. Non-interactive runs without an editor are rejected with `NOTCH_SEED_REVIEW_REQUIRED`.

Use `--file <relative-path>` to carry selected source file references as links. V1 does not ingest file bodies during seeding.

The secret scanner fires on any seed content containing words like `secret`, `password`, `token`, or `api_key` — even when used in legitimate documentation prose (for example, "Never commit secrets to .env"). This is intentional: seed packets land in private storage that may later be shared with agents, so the scanner errs on the side of false positives. If a seed is blocked by `NOTCH_SECRET_DETECTED` on benign source text, rephrase the trigger words in your source brief and re-run.

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
