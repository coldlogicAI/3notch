# Contributing

Thanks for considering a contribution. 3Notch is a small, deliberate project — keeping it that way is the goal.

## Before You Open A PR

- **Open an issue first** for anything bigger than a bug fix or doc tweak. The [Boundaries](README.md#boundaries) and [Where We Want Help](README.md#where-we-want-help) sections in the README cover what is and isn't in scope. Most "wouldn't it be cool if..." additions belong as third-party tools on top of the stable schema, not in core.
- **Read the relevant doc** under `docs/guides/` or `docs/reference/` before changing behavior. If your change makes a doc wrong, update the doc in the same PR.
- **Don't reformat for taste.** Lint and TypeScript settle most style debates. If you want a tooling change, propose it in its own issue.

## Development Loop

```bash
git clone <repo>
cd 3notch
npm install

npm run lint           # ESLint over src + tests
npm run type-check     # tsc --noEmit
npm run build          # tsup → dist/cli/index.js
npm test               # vitest unit + integration
npm run test:e2e       # vitest e2e (slower; uses real CLI subprocesses)
```

Every PR must pass `lint`, `type-check`, `build`, and `test` locally. CI runs the same on Ubuntu, macOS, and Windows under Node 20 and 22; please match that surface before opening a PR.

For a quick built-CLI smoke after `build`:

```bash
node dist/cli/index.js --help
node dist/cli/index.js --version
```

## End-To-End Demo From A Fresh Clone

The fastest way to confirm a change works across the cross-repo loop:

```bash
WORKDIR="$(mktemp -d)"
mkdir -p "$WORKDIR/source-app" "$WORKDIR/destination-app"
node dist/cli/index.js --cwd "$WORKDIR/source-app" onboard --yes --name source-app
node dist/cli/index.js --cwd "$WORKDIR/destination-app" onboard --yes --name destination-app

CREATE_JSON="$(node dist/cli/index.js --cwd "$WORKDIR/source-app" --json packet create \
  --title "Current repo state" \
  --summary "Checkout and admin settings changed." \
  --to-agent claude \
  --to-repo "$WORKDIR/destination-app" \
  --file README.md \
  --next-steps "Review README.md and continue the destination setup.")"
PACKET="$(printf '%s' "$CREATE_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).outboxPath))")"
PACKET_ID="$(printf '%s' "$CREATE_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).packet.id))")"

node dist/cli/index.js --cwd "$WORKDIR/source-app" packet preview "$PACKET_ID" --outbox
node dist/cli/index.js --cwd "$WORKDIR/destination-app" packet import "$PACKET"
node dist/cli/index.js --cwd "$WORKDIR/destination-app" packet list --inbox
```

## Repo Layout

| Path | What's there |
| --- | --- |
| `src/cli/` | CLI commands, program wiring, output formatting |
| `src/core/` | Services: store, packet, brief, transfer, archive, artifact, scanner, audit, doctor, check, index |
| `src/mcp/` | MCP server, tool wiring, tool schemas |
| `src/schemas/` | JSON Schema definitions for records, audit log, MCP tools |
| `src/types/` | TypeScript record + error types |
| `src/templates/` | Onboarding templates |
| `tests/unit/` | Pure unit tests |
| `tests/cli/` | CLI tests via `runCli` helper (subprocess) |
| `tests/mcp/` | MCP tool tests |
| `tests/schema/` | Schema validation tests |
| `tests/e2e/` | Full workflow tests |
| `tests/fixtures/` | Test fixtures (records, stores) |
| `fixtures/` | Demo `.notch/` stores for docs and e2e tests |
| `docs/guides/` | Task-shaped how-tos |
| `docs/reference/` | Privacy posture, security model |
| `docs/prompts/` | Paste-ready agent prompts |
| `docs/archived-plans/` | Shipped version plans (historical record) |

The [V1 technical spec](docs/archived-plans/v1/3notch-v1-technical-spec.md) is still the authoritative architectural reference for record types, store layout, error codes, and service boundaries.

## What Gets Reviewed

- **Bug fixes**: open a PR with a regression test. Bonus points for an `audit.jsonl` line or error code in the PR description.
- **Doc fixes**: open a PR. Keep the tone of the surrounding doc.
- **New behavior**: open an issue first. Most new behavior is either out of scope ([Boundaries](README.md#boundaries)) or belongs in [Where We Want Help](README.md#where-we-want-help). Both lists exist so contributors don't write code that won't merge.
- **Schema changes**: open an issue first. The schemas in `src/schemas/` are part of the contract external tooling builds against.

## Commit Conventions

Conventional Commits (`type: subject`):

- `feat: ...` new behavior
- `fix: ...` bug fix
- `docs: ...` documentation only
- `test: ...` tests only
- `chore: ...` tooling, config, repo hygiene
- `refactor: ...` no behavior change

Keep PRs scoped — one logical change per PR. Multiple small PRs are easier to review than one large one.

## Received Records Are Ground Truth

3Notch refuses to overwrite records in `.notch/inbox/` or `.notch/private/inbox/`. Changes to imported context happen via successor packets (`--supersedes`) or typed replies (`notch reply`). Any code change that touches inbox writes must preserve this invariant; the immutability test in `tests/unit/store-service.test.ts` is a regression guard.

## Things That Will Be Rejected

To keep review time predictable:

- **Telemetry, analytics, cloud sync, hosted services, account systems, remote relays.** Not in scope.
- **SQLite, native databases, vector databases, semantic search engines.** Not in scope.
- **Chat-history or project-state scraping.** Not in scope.
- **Arbitrary shell execution through MCP.** Not in scope.
- **The deferred verbs**: `pass`, `send`, `decision *`, `question *`, `conflict *`, `stale *`, `lint`. A regression-guard test (`tests/unit/no-deferred-commands.test.ts`) enforces this.
- **Reformatting passes** unrelated to a real change.
- **Renames that break public CLI flags, MCP tool names, or schema field names** without a deprecation cycle.

## Security Reports

See [SECURITY.md](SECURITY.md).

## License

By contributing you agree your contributions will be licensed under the MIT license that covers this repository.
