# 3Notch V2 Long-Run Goal Prompt

Use this prompt to start a persistent `/goal` implementation session for V2.

```text
/goal Implement 3Notch V2 from the local plan.

You are Codex working in this repo. V1 and V1.1 are shipped and archived. V2 ships six themes: wiki-use-case primitives (`supersedes` + `.notch/index/relationships.json`), self-addressed capture (`notch mark`), reply schema primitives (`replyTo`/`replyType`/`status` + `notch reply`), web-chat intake bridge (`notch prompt --client claude-chat` + `notch packet import -` stdin), corpus integrity check (`notch check`), and inbox immutability. Work wave-by-wave until V2 acceptance criteria are met.

Read first:
1. AGENTS.md
2. .codex/rules/3notch-v1.md
3. docs/active-plans/v2/3notch-v2-plan.md
4. docs/archived-plans/v1/3notch-v1-technical-spec.md (architecture invariants)
5. docs/archived-plans/v1.1/3notch-v1.1-plan.md (V1.1 context)

Hard scope boundaries (Steinberger filter):
- V2 ships only the six themes above.
- No new top-level record types. Marks and replies are packets.
- No agent UX for surfacing open replies; no resolution flows; no digests or notifications.
- No auto-tagging, similarity threading, or contradiction flagging — semantic derivation is out.
- No wiki UI / browse / graph view.
- No encryption at rest, DXT packaging, hosted sync, or hub `.notch/` aggregator.
- No `notch check` rules beyond the five specified (broken supersedes, broken replyTo, cycle, self-reference, fork).
- Do not re-introduce deferred V1/V1.1 surfaces (pass, send, decision, question, conflict, stale). Regression-guard test enforces.
- Do not add telemetry. Telemetry-denylist test enforces.
- No destructive Git or remote creation without approval.

IP-hygiene rule (perpetual, not just V2):
- Verb `lint` is reserved. NEVER ship `lint` in 3Notch OSS. Use `check`, `verify`, or `validate` for integrity work.
- `notch check` is deterministic structural only. No LLM-based, schema-driven, or semantic rules. Ever.
- No cross-store / cross-user / cross-facility aggregation in any form. Stays out of OSS.

Execution discipline:
- Work in dependency order. Wave 1 (`supersedes` + relationships.json + immutability) lands first; Waves 2–5 build on it.
- Keep slices small, tested, logged, committed.
- Update docs/active-plans/v2/v2-implementation-log.md after each coherent slice.
- If plan and implementation disagree, prefer V1 spec for architecture invariants; for new V2 surfaces, prefer V2 plan and log corrections.

Before each implementation commit:
- npm run lint && npm run type-check && npm run build && npm test (plus focused tests / built CLI smokes when relevant)

Final verification:
- npm run lint && npm run type-check && npm run build && npm test && npm run test:e2e
- node dist/cli/index.js --help
- node dist/cli/index.js --version
- node dist/cli/index.js mark --summary "smoke"
- node dist/cli/index.js reply <id> --type question --summary "smoke"
- node dist/cli/index.js packet import - (fed by stdin fixture)
- node dist/cli/index.js prompt --client claude-chat
- node dist/cli/index.js check
- node dist/cli/index.js check --json
- E2E smokes for Waves 1–5 (plan steps 7.1 through 7.5)

Completion criteria:
- V2 plan steps 1.1 through 7.5 implemented or logged as user-approved deferrals.
- README leads with user-as-bus framing; shows three canonical paths (same-store cross-tool, cross-repo packet, web-chat-to-project bridge).
- CHANGELOG.md has a 0.3.0 section listing all V2 additions.
- CI green across the matrix.
- No `lint` verb shipped. No semantic check rules. No cross-store aggregation.
- No deferred surface or telemetry introduced.
- Worktree clean.

Stop only for:
- user approval needed for dependency install, auth, remote creation, destructive Git, or other privileged action;
- a product decision not safely inferrable from the V2 plan or memory;
- a hard technical blocker logged with evidence.
```
