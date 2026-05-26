# Private Context Seeding

Private context seeding carries reviewed user preferences and workflow conventions from prior work into a new repo. The output lives under `.notch/private/`, which is gitignored by default.

```bash
notch seed from ../old-project --review --include preferences --include workflow
notch packet list --private --purpose seed
```

Seed packets carry `purpose: seed` and `sensitivity: private`. They are local files; nothing leaves the machine.

## The Review Gate

`--review` writes a draft packet to a temp file and opens `$EDITOR`. Save a real edit before closing — non-interactive runs without an editor are rejected with `NOTCH_SEED_REVIEW_REQUIRED`. The review gate is deliberate: seed packets become reusable context the agent reads, so what goes in needs human eyes first.

## Selecting Source Files

```bash
notch seed from ../old-project --file CONVENTIONS.md --file docs/workflow.md
```

`--file` records a source-link pointer. Seeding does not ingest file bodies — only the path is preserved. Open the files yourself during review.

## The Scanner Is Aggressive On Seeds

The secret scanner fires on any seed content containing words like `secret`, `password`, `token`, or `api_key` — even in legitimate documentation prose ("Never commit secrets to .env"). This is intentional: seed packets land in private storage that agents later read, so the scanner errs toward false positives. If a benign seed is blocked by `NOTCH_SECRET_DETECTED`, rephrase the trigger words in your source brief and re-run.

## MCP Visibility

Private records are hidden from MCP by default:

```bash
notch mcp serve                       # private records hidden
notch mcp serve --include-private     # private records visible to this server only
```

Start with `--include-private` only when the current client genuinely needs to read private seed context. The flag is per-process, not persisted.

## What Belongs Here

- User workflow preferences.
- Reusable conventions from prior projects.
- Lessons explicitly reviewed and worth carrying forward.

What does not belong:

- Credentials, API keys, tokens.
- Raw chat history.
- Unreviewed private material.
- Project-specific decisions that should travel as packets, not seeds.
