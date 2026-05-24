# 3Notch V1 Long-Run Goal Prompt

Use this prompt to start a persistent `/goal` implementation session.

```text
/goal Implement 3Notch V1 end-to-end from the local repo plan.

You are Codex working in this repo. This is a long-running implementation goal, not an advisory session. Work wave-by-wave until V1 acceptance criteria are met or a real blocker needs user approval.

Read first:
1. AGENTS.md
2. .codex/rules/3notch-v1.md
3. docs/3notch-v1-technical-spec.md
4. docs/3notch-v1-implementation-plan.md
5. docs/3notch-project-request.md
6. docs/3notch-branding-review.md

Product boundaries:
- V1 ships only three loops: packet transfer, private context seeding, targeted briefs. Supporting commands: onboard, status, doctor, mcp serve.
- Core direction: explicit, reviewable context packets across repos and AI tools. No hidden chat/project scraping.
- Source records stay human-readable under `.notch/`; outbox/inbox/private/index/logs follow AGENTS.md.
- Do not implement deferred commands or MCP tools: pass, send, decision, question, conflict, stale.
- No telemetry, cloud sync, hosted service, login, vector DB, SQLite/native DB, arbitrary MCP shell execution, DXT, or remote connector.
- No destructive Git or GitHub remote creation without approval.

Execution discipline:
- Reconcile against Wave 1; package/build/test config and CLI skeleton are done. Start with Step 1.4 test harness helpers unless evidence says otherwise.
- Work the plan in dependency order. Keep slices small, tested, logged, and committed.
- Update `docs/v1-implementation-log.md` after each coherent slice with date, commit hash if available, files touched, tests, and next step.
- If plan and implementation disagree, prefer the technical spec and log the correction.
- Preserve user docs/history. Keep paste-ready `/goal` prompts under 4,000 characters by moving detail into docs.

Before each implementation commit:
- npm run lint
- npm run type-check
- npm run build
- npm test
- focused tests and built CLI smoke checks when relevant

Final verification:
- npm run lint
- npm run type-check
- npm run build
- npm test
- npm run test:e2e
- node dist/cli/index.js --help
- node dist/cli/index.js --version
- onboard, cross-repo packet, private seed, cross-tool MCP, doctor/status, telemetry-denylist, and deferred-surface smoke tests

Completion criteria:
- V1 acceptance criteria are implemented or logged as user-approved deferrals.
- README quickstart works from a fresh clone.
- CI covers lint, type-check, build, tests, and e2e on Node 20/22 across Ubuntu/macOS/Windows.
- No forbidden dependencies or telemetry paths exist.
- Worktree is clean and all implementation commits are local.

Stop only for:
- user approval needed for dependency install, auth, remote creation, destructive Git operation, or other privileged action;
- a product decision that cannot be safely inferred from the spec/plan;
- a hard technical blocker that remains after focused debugging and is logged with evidence.
```
