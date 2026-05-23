# 3Notch V1 Long-Run Goal Prompt

Use this prompt to start a persistent `/goal` implementation session.

```text
/goal Implement 3Notch V1 end-to-end from the local repo plan.

You are Codex working in this repository. This is a long-running implementation goal, not a short advisory session. Continue working wave-by-wave until V1 acceptance criteria are met, or until a real blocker requires user approval.

Read first:
1. AGENTS.md
2. .codex/rules/3notch-v1.md
3. 3notch-v1-technical-spec.md
4. 3notch-v1-implementation-plan.md
5. 3notch-project-request.md
6. 3notch-branding-review.md

Primary product requirements:
- 3Notch is a local-first CLI and MCP server for private context seeding and cross-repo context packets.
- Private context seeding is core V1, not scope creep.
- Cross-repo packet transfer is core V1, not a later export feature.
- Source records are human-readable Markdown/YAML files under `.notch/`.
- Created project packets live in `.notch/outbox/`; imported project packets live in `.notch/inbox/`.
- Private seed packets live in ignored `.notch/private/` and are not exposed through MCP unless the server/session explicitly enables private context.
- Derived `.notch/index/` and `.notch/logs/` output must be rebuildable.

Hard boundaries:
- Do not add telemetry, analytics, hosted sync, cloud dependencies, login, billing, dashboards, vector databases, semantic search dependencies, SQLite/native DB bindings, broad orchestration, arbitrary MCP shell execution, or automatic private chat scraping.
- Do not create or push GitHub remotes without explicit approval.
- Do not run destructive Git operations without explicit approval.
- Do not silently merge imported packet contents into destination source records.

Execution discipline:
1. Start by reconciling the current repo against Wave 1 in `3notch-v1-implementation-plan.md`; mark or skip already-completed bootstrap tasks mentally, but do not rewrite history.
2. Work through the implementation plan in dependency order.
3. Keep each slice small enough to test and commit.
4. Update `docs/v1-implementation-log.md` after each coherent slice or wave with date, commit hash if available, files touched, tests run, and next step.
5. Commit each verified slice with a clear message.
6. Keep the worktree clean after each commit unless actively working.
7. If tests fail, fix the failure before moving on unless the failure is a documented blocker.
8. If implementation evidence contradicts the plan, prefer `3notch-v1-technical-spec.md` for architecture and record any plan correction in the implementation log.
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
- Private seed smoke test: old repo/store seeds new repo `.notch/private/inbox/`, private seed is Git-ignored, MCP hides it by default, MCP reads it only with private context enabled.
- Cross-repo packet smoke test: repo A creates packet, repo B imports packet into `.notch/inbox/`, CLI and MCP can read it, and destination source records are not silently merged.
- Doctor/status smoke test on healthy and intentionally corrupted stores.

Completion criteria:
- Every V1 acceptance criterion in `3notch-v1-technical-spec.md` is implemented or explicitly logged as a user-approved deferral.
- The README quickstart works from a fresh clone.
- CI covers lint, type-check, build, tests, and e2e.
- No forbidden dependencies or telemetry paths exist.
- Worktree is clean.
- All implementation commits are present locally.

Stop only for:
- user approval needed for dependency install, auth, remote creation, destructive Git operation, or other privileged action;
- a product decision that cannot be safely inferred from the spec/plan;
- a hard technical blocker that remains after focused debugging and is logged with evidence.
```
