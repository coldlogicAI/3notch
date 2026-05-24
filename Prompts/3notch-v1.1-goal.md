# 3Notch V1.1 Long-Run Goal Prompt

Use this prompt to start a persistent `/goal` implementation session for V1.1.

```text
/goal Implement 3Notch V1.1 from the local plan.

You are Codex working in this repo. V1 is shipped and archived; V1.1 adds agent-driven workflow, MCP auto-config for two clients, a standalone secret scanner, packet preview, and a concrete security-story doc. Work wave-by-wave until V1.1 acceptance criteria are met.

Read first:
1. AGENTS.md
2. .codex/rules/3notch-v1.md
3. docs/active-plans/v1.1/3notch-v1.1-plan.md
4. docs/archived-plans/v1/3notch-v1-technical-spec.md (architecture invariants)

Hard scope boundaries (Steinberger filter):
- V1.1 ships only three themes: agent-driven workflow, setup friction reduction, concrete security story.
- No new MCP tools. The existing 12 cover the workflows.
- No new record types or schemas.
- Do not implement: notch packet update, notch packet diff, notch audit report, per-packet redaction, hub store, encryption at rest, DXT packaging, hosted sync.
- Do not re-introduce deferred V1 surfaces (pass, send, decision, question, conflict, stale). The regression-guard test enforces this.
- Do not add telemetry. The telemetry-denylist test enforces this.
- Do not run destructive Git or create GitHub remotes without approval.

Execution discipline:
- Work the plan in dependency order. Keep slices small, tested, logged, committed.
- Update docs/active-plans/v1.1/v1.1-implementation-log.md after each coherent slice.
- If plan and implementation disagree, prefer the V1 spec for architecture invariants; for new V1.1 commands, prefer the V1.1 plan and log the correction.
- Keep paste-ready /goal prompts under 4,000 characters.

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
- node dist/cli/index.js prompt --client claude-code
- node dist/cli/index.js scan README.md
- onboard --mcp claude-desktop and --mcp claude-code smoke against injected temp config homes
- agent-driven-handoff-smoke and onboard-mcp-config-smoke e2e tests

Completion criteria:
- V1.1 plan items 1.1 through 5.1 are implemented or logged as user-approved deferrals.
- README quickstart leads with the agent-driven flow.
- CHANGELOG.md has a V1.1 section.
- CI still green across the matrix.
- No deferred surface or telemetry introduced.
- Worktree clean.

Stop only for:
- user approval needed for dependency install, auth, remote creation, destructive Git, or other privileged action;
- a product decision not safely inferrable from the V1.1 plan;
- a hard technical blocker logged with evidence.
```
