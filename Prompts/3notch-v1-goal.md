# 3Notch V1 Long-Run Goal Prompt

Use this prompt to start a persistent `/goal` implementation session.

```text
/goal Implement 3Notch V1 end-to-end from the local repo plan.

You are Codex working in this repository. This is a long-running implementation goal, not a short advisory session. Continue working wave-by-wave until V1 acceptance criteria are met, or until a real blocker requires user approval.

Read first:
1. AGENTS.md
2. .codex/rules/3notch-v1.md
3. docs/3notch-v1-technical-spec.md
4. docs/3notch-v1-implementation-plan.md
5. docs/3notch-project-request.md
6. docs/3notch-branding-review.md

Primary product requirements:
- 3Notch is a local-first CLI and MCP server for moving project context across boundaries that built-in AI tooling cannot cross: across repos, across AI work surfaces, and into new projects.
- V1 ships exactly three loops: packet transfer, private context seeding, and targeted briefs. Plus supporting commands: onboard, status, doctor, mcp serve.
- Cross-repo packet transfer is core V1, not a later export.
- Private context seeding is core V1.
- Cross-tool handoff is the core direction: Claude Desktop, Claude Code, Codex, Cursor, ChatGPT, and local agents exchange context through explicit reviewable packets.
- Source records are human-readable Markdown/YAML files under `.notch/`.
- Created project packets live in `.notch/outbox/`; imported project packets live in `.notch/inbox/`.
- Private seed packets live in ignored `.notch/private/` and are not exposed through MCP unless the server is started with `--include-private`.
- Derived `.notch/index/` and `.notch/logs/` output must be rebuildable.

Hard scope boundaries:
- Do not implement `notch pass`, `notch send`, `notch decision *`, `notch question *`, `notch conflict *`, or `notch stale *`. Same-repo same-session continuity is solved by CLAUDE.md, native tool memory, and `git commit`. 3Notch's wedge is cross-boundary transport. A regression-guard test (`tests/unit/no-deferred-commands.test.ts`) enforces this.
- Do not add their MCP equivalents (`create_pass`, `get_latest_pass`, `get_recent_passes`, `record_decision`, `get_decisions`, `add_open_question`, `get_open_questions`, `create_conflict`, `list_conflicts`, `resolve_conflict`, `mark_context_stale`).
- Do not add telemetry, analytics, hosted sync, cloud dependencies, login, billing, dashboards, vector databases, semantic search dependencies, SQLite/native DB bindings, broad orchestration, arbitrary MCP shell execution, hidden chat/project scraping, DXT packaging, or remote connectors.
- Do not create or push GitHub remotes without explicit approval.
- Do not run destructive Git operations without explicit approval.
- Do not silently merge imported packet contents into destination source records.

Execution discipline:
1. Reconcile the current repo against Wave 1 in `docs/3notch-v1-implementation-plan.md`; the package, build/test config, and CLI skeleton are already done. Start with Step 1.4 (test harness helpers) unless evidence shows otherwise.
2. Work through the implementation plan in dependency order.
3. Keep each slice small enough to test and commit.
4. Update `docs/v1-implementation-log.md` after each coherent slice or wave with date, commit hash if available, files touched, tests run, and next step.
5. Commit each verified slice with a clear message.
6. Keep the worktree clean after each commit unless actively working.
7. If tests fail, fix the failure before moving on unless the failure is a documented blocker.
8. If implementation evidence contradicts the plan, prefer `docs/3notch-v1-technical-spec.md` for architecture and record any plan correction in the implementation log.
9. Preserve user docs and existing committed history; do not overwrite planning documents casually during implementation.

Required verification before each implementation commit:
- npm run lint
- npm run type-check
- npm run build
- npm test
- Relevant focused tests for the slice
- Relevant built CLI smoke check when CLI behavior changes

Required final verification:
- npm run lint
- npm run type-check
- npm run build
- npm test
- npm run test:e2e
- node dist/cli/index.js --help
- node dist/cli/index.js --version
- Fresh temp project smoke test for `notch onboard`
- Cross-repo packet smoke: repo A creates packet, repo B imports packet into `.notch/inbox/`, CLI and MCP can read it, destination source records are not silently merged.
- Private seed smoke: old repo/store seeds new repo `.notch/private/inbox/`, private seed is Git-ignored, MCP hides it by default, MCP reads it only with `--include-private`.
- Cross-tool handoff smoke: an MCP caller can create a packet from explicitly supplied session context, another store can import it, no tool requires raw chat-history access.
- Doctor/status smoke test on healthy and intentionally corrupted stores.
- Telemetry-denylist test passes against `package.json`, lock file, source, and built output.
- Deferred-surface guard test confirms no Commander command or MCP tool named `pass`, `send`, `decision`, `question`, `conflict`, or `stale` exists in source.

Completion criteria:
- Every V1 acceptance criterion in `docs/3notch-v1-technical-spec.md` is implemented or explicitly logged as a user-approved deferral.
- The README quickstart works from a fresh clone.
- CI covers lint, type-check, build, tests, and e2e across a matrix of Ubuntu/macOS/Windows on Node 20 and 22.
- No forbidden dependencies or telemetry paths exist.
- Worktree is clean.
- All implementation commits are present locally.

Stop only for:
- user approval needed for dependency install, auth, remote creation, destructive Git operation, or other privileged action;
- a product decision that cannot be safely inferred from the spec/plan;
- a hard technical blocker that remains after focused debugging and is logged with evidence.
```
