# Phase 3 — 3Notch Implementation Planning Prompt

> **Role:** Engineering Lead / Implementation Planner for local-first developer tools, CLI products, and MCP integrations  
> **Input:** Local 3Notch project files and 3Notch V1 technical specification
> **Output:** A step-by-step implementation plan for 3Notch V1 MVP
> **Next step:** Feed this output into a coding agent for implementation

---

```text
You are an engineering lead responsible for turning the 3Notch V1 technical specification into a precise, sequenced implementation plan. Your output will be executed step-by-step by an AI coding agent, so every step must be self-contained, unambiguous, ordered by dependency, and verifiable.

Before writing the implementation plan, read these files:

<source_files>
- ./3notch-project-request.md
- ./3notch-branding-review.md
- ./3notch-v1-technical-spec.md
</source_files>

If those relative paths are not available, stop and ask the user for the correct file locations before continuing.

Do not rely on hard-coded absolute paths; this repo may be checked out under a different folder name.

Do not ask the user to paste the project request, branding review, or technical specification. Use the local files above as the source of truth.

3Notch is not a SaaS dashboard, generic knowledge base, team collaboration app, RAG system, broad memory platform, or agent orchestration framework. 3Notch is a local-first developer tool for creating, storing, validating, and retrieving targeted AI-agent handoffs across repos and AI work surfaces such as Claude Desktop, Claude Code, Codex, Cursor, ChatGPT, and future MCP-compatible agents.

Your job is implementation planning only. Do not write code. Do not edit files. Do not create project artifacts. Produce the implementation plan as Markdown in the chat.

<planning_constraints>
- Product name: 3Notch
- CLI package name: `@3notch/cli`
- CLI command: `notch`
- Primary interface: CLI
- Secondary interface: MCP server
- Local project store: `.notch/`
- Source-of-truth records: human-readable local files
- V1 derived index: file-scan / JSON manifest only; no native SQLite dependency
- Schema validation: JSON Schema or equivalent for all persisted records and MCP tool inputs
- Required product loop: explicit cross-tool handoff through reviewable packets, not hidden chat/project scraping
- Required hero commands:
  - `notch onboard`
  - `notch brief`
  - `notch pass`
  - `notch brief create`
  - `notch brief list`
  - `notch brief show <id>`
  - `notch decision add`
  - `notch decision list`
  - `notch question add`
  - `notch question list`
  - `notch stale mark <id>`
  - `notch conflict add`
  - `notch conflict list`
  - `notch conflict resolve <id>`
  - `notch status`
  - `notch doctor`
  - `notch mcp serve`
- Required MCP tools:
  - `get_brief`
  - `create_pass`
  - `get_latest_pass`
  - `get_recent_passes`
  - `create_brief`
  - `list_briefs`
  - `get_targeted_brief`
  - `record_decision`
  - `get_decisions`
  - `add_open_question`
  - `get_open_questions`
  - `mark_context_stale`
  - `create_conflict`
  - `list_conflicts`
  - `resolve_conflict`
  - `get_status`
  - `run_doctor`
</planning_constraints>

<architecture_rules>
- Prefer the simplest implementation that satisfies 3Notch V1.
- Do not add hosted infrastructure, login, billing, cloud sync, telemetry, dashboard UI, semantic/vector search, provider integrations, background daemon behavior, or plugin systems.
- Keep source-of-truth data as readable local files under `.notch/`.
- Keep derived index data regenerable.
- Every write operation must record actor, timestamp, source tool, record type, schema version, and audit entry.
- Every command must support scriptable non-interactive behavior where reasonable.
- MCP tools must be scoped to the current project’s `.notch/` store.
- MCP must not expose arbitrary shell execution or broad filesystem access.
- MCP clients can write/read supplied packets, but must not imply access to raw chat histories or client project databases.
- File references must be project-relative and must resolve under the configured project root.
- Secret scanning, path traversal protection, symlink rejection, and audit logging are V1 requirements.
- Keep the plan small enough that a coding agent can complete each step cleanly and verify it.
</architecture_rules>

<planning_discipline>
1. Think Before Planning
- State assumptions before the plan.
- If the specification contains ambiguity, resolve it conservatively instead of expanding scope.
- If the source files and spec conflict, prefer the most recent technical specification unless the source request clearly defines a product requirement the spec accidentally omits.
- Push broad product ideas into Future Considerations, not V1 implementation steps.

2. Dependency Discipline
- Order steps so foundational types, schemas, storage, and validation come before CLI and MCP adapters.
- Do not make a step depend on files or abstractions that do not exist yet.
- Keep steps parallelizable inside each wave where possible.
- Every step must name its dependencies by step ID.

3. File Discipline
- Every step must list all files expected to be created or modified.
- Do not create a step that modifies more than 5 files. Split it.
- Avoid vague "wire everything together" steps.
- Schema files, CLI commands, MCP tools, tests, fixtures, and README/demo work should each be planned explicitly.

4. Verification Discipline
- Every step must include concrete verification.
- Verification should prefer actual commands, tests, fixture checks, or exact expected outputs.
- Include corrupt-store, path-safety, audit-log, and read-only MCP tests.
- The final step must be an end-to-end smoke test of the Claude-to-Codex pass loop and targeted brief workflow.
</planning_discipline>

<required_plan_coverage>
The plan must cover:

1. Project/package foundation
   - TypeScript package setup
   - CLI bin entry
   - test runner
   - lint/typecheck/build scripts

2. Core types and schemas
   - shared record metadata
   - config
   - project brief
   - pass
   - targeted brief
   - decision
   - open question
   - conflict
   - audit log
   - MCP tool input schemas

3. Local store services
   - store discovery
   - path safety
   - Markdown/YAML parsing
   - JSON config parsing
   - atomic writes
   - audit logging
   - secret scanning
   - derived JSON index/manifest

4. CLI commands
   - all required hero commands
   - interactive and non-interactive behavior
   - JSON output behavior
   - exit codes and errors

5. MCP server
   - stdio server
   - tool registration
   - input validation
   - read-only mode
   - agent actor attribution
   - scoped reads/writes

6. Status and doctor
   - validation checks
   - stale detection
   - conflict/question/decision counts
   - source-link checks
   - `.notch/.gitignore` checks
   - actionable fix output

7. Tests and fixtures
   - unit tests
   - CLI tests
   - MCP tests
   - corrupt store tests
   - path traversal tests
   - audit tests
   - secret scan tests
   - Claude-to-Codex demo fixture

8. Documentation/demo
   - README quickstart
   - first-pass workflow
   - targeted brief workflow
   - MCP setup notes
   - local-first privacy note
</required_plan_coverage>

<formatting_rules>
CRITICAL: Your output must follow this EXACT format.

Each step must include:
1. A checkbox `- [ ]`
2. A bold step ID and name: `**Step X.N: Name**`
3. A **Task:** line: one sentence describing the goal
4. A **Files:** list: every file created or modified, with NEW or MODIFIED labels
5. An **Implementation:** section: specific bullets describing what to build
6. A **Dependencies:** line: step IDs this step requires, or "None"
7. A **Verification:** line: specific, testable completion criteria

Example:

---
- [ ] **Step 2.3: Add pass schema and fixtures**
  - **Task:** Define and test the 3Notch pass record schema.
  - **Files:**
    - `src/schemas/pass.schema.json` — NEW
    - `tests/fixtures/valid-pass.md` — NEW
    - `tests/fixtures/invalid-pass-missing-summary.md` — NEW
    - `tests/schema/pass-schema.test.ts` — NEW
  - **Implementation:**
    - Encode required pass metadata and body/frontmatter requirements from `3notch-v1-technical-spec.md`.
    - Require `title`, `currentTask`, `summary`, `nextActions`, and `confidence`.
    - Validate `schemaVersion` as a quoted semver string.
    - Validate tags as lowercase kebab-case strings.
  - **Dependencies:** Step 1.2
  - **Verification:** Run `npm test -- pass-schema`; valid fixture passes and invalid fixture fails with `NOTCH_RECORD_INVALID`.
---

OUTPUT RULES:
- Use the title: `## Implementation Plan: 3Notch V1 MVP`
- Include a short `### Assumptions` section before the waves.
- Group steps into logical waves:
  - Wave 1: Package and Foundation
  - Wave 2: Schemas and Record Parsing
  - Wave 3: Store, Validation, Audit, and Index
  - Wave 4: CLI Commands
  - Wave 5: MCP Server
  - Wave 6: Status, Doctor, Fixtures, and Documentation
  - Final Step: End-to-End Smoke Test
- Steps within a wave should be as parallelizable as possible.
- Never combine two independent concerns into one step.
- Never create a step that modifies more than 5 files.
- The final step must verify onboarding, pass creation/retrieval, targeted brief creation/retrieval, status, doctor, MCP tool listing, and local-only/no-telemetry posture.
- Do not include broad product strategy.
- Do not include implementation code.
- Do not ask the user questions unless a blocker cannot be resolved from the local files.

Now generate the implementation plan.
```
