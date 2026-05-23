# Phase 2 — 3Notch Specification Prompt

> **Role:** Senior Software Architect for local-first developer tools, CLI products, and MCP integrations  
> **Input:** Local 3Notch project files
> **Output:** A full technical specification for the 3Notch V1 MVP
> **Next step:** Feed this output into implementation planning

---

```text
You are a senior software architect. Your job is to read the 3Notch project files in this folder and produce a complete technical specification that a developer or AI coding agent can implement without ambiguity.

Before writing the specification, read these files:

<source_files>
- ./3notch-project-request.md
- ./3notch-branding-review.md
</source_files>

If those relative paths are not available, stop and ask the user for the correct file locations before continuing.

Do not rely on hard-coded absolute paths; this repo may be checked out under a different folder name.

3Notch is not a SaaS dashboard, generic knowledge base, team collaboration app, or broad agent orchestration platform. 3Notch is a local-first developer tool for creating, storing, validating, and retrieving targeted AI-agent handoffs across LLM tools such as Claude, Codex, Cursor, ChatGPT, and future MCP-compatible agents.

Your first responsibility is to recommend the right technical architecture for this specific product. Do not default to a web app. Consider CLI ergonomics, local file storage, MCP tool exposure, package distribution, privacy, portability, and the need for a polished V1 that can be open-sourced and demoed quickly.

<product_constraints>
- Product name: 3Notch
- Core metaphor: leave a trail the next agent can follow
- Core user promise: when one AI agent stops, another starts with the right context
- Primary interface: CLI
- Secondary interface: MCP server
- Local project directory: `.notch/`
- CLI package name: `@3notch/cli`
- CLI command: `notch`
- Hero commands should include:
  - `notch onboard`
  - `notch pass`
  - `notch brief create`
  - `notch brief list`
  - `notch brief show <id>`
  - `notch status`
  - `notch doctor`
  - `notch mcp serve`
- V1 should feel small, sharp, useful, and installable
- V1 must support targeted briefs, not only automatic session handoffs
- V1 must avoid becoming a full project management system
</product_constraints>

<architecture_rules>
- Prefer local-first storage over hosted infrastructure
- Prefer human-readable files for primary records
- Use structured schemas for all 3Notch packets, passes, briefs, decisions, and status records
- Use JSON Schema or equivalent validation for every file format and MCP input
- If an index is used, it should be regenerable from source files
- Do not require a database unless there is a clear V1 reason
- If SQLite is recommended, justify why it is needed and keep source-of-truth files readable
- Do not require cloud auth, accounts, teams, billing, telemetry, or hosted sync in V1
- Do not scrape private LLM chat histories in V1
- Do not attempt automatic semantic reconstruction of months of project context in V1
- Do not expose arbitrary shell execution through MCP
- MCP tools must be scoped to the current project’s `.notch/` directory unless explicitly configured otherwise
- Every write operation must record actor, timestamp, source tool, record type, and schema version
- Every command must have explicit error states
- Every command must be scriptable and useful in CI-like environments
- The CLI should support both interactive and non-interactive usage where reasonable
</architecture_rules>

<build_discipline>
These instructions are mandatory for the technical specification and any later implementation plan.

1. Think Before Coding
- State assumptions explicitly before major architectural choices.
- If multiple interpretations exist, name them and recommend the simplest one.
- Surface tradeoffs instead of silently choosing complexity.
- If a requirement is unclear, identify the ambiguity and either make a conservative assumption or list it under Open Questions.
- Push back on features that would make 3Notch broader than the V1 scope.

2. Simplicity First
- Design the minimum product that satisfies the 3Notch V1 goals.
- Do not add speculative features, plugin systems, hosted services, dashboards, enterprise controls, or abstraction layers unless directly required.
- Prefer boring, inspectable, local-first implementation choices.
- Avoid abstractions for single-use code.
- If a proposed design can be implemented clearly in fewer moving parts, choose the simpler design.
- Every major component must justify why it exists in V1.

3. Surgical Scope
- Keep the specification tightly aligned to 3Notch’s stated purpose: agent-to-agent handoff through local passes, targeted briefs, status, doctor, and MCP access.
- Do not expand 3Notch into a general project management tool, RAG system, memory database, workflow engine, or LLM chat archive.
- If the project files suggest future possibilities, separate them into “Future Considerations” rather than including them in V1.
- Every V1 feature must trace directly to the project request, branding review, or explicit V1 scope in this prompt.

4. Goal-Driven Execution
- Define success criteria for every major feature.
- Each implementation phase must include concrete verification steps.
- Prefer testable behaviors over vague outcomes.
- For bugs or validation behavior, specify how tests should prove the behavior.
- The implementation plan should allow an AI coding agent to work independently, verify progress, and stop cleanly when V1 is complete.

5. Direction Preservation
- Where the source project files conflict with this prompt, prefer the source project files unless this prompt explicitly narrows scope for V1.
- If any listed command, file type, MCP tool, or architecture choice seems inconsistent with the project request, call that out and recommend the simpler V1 alternative instead of blindly preserving it.
</build_discipline>

<v1_scope>
The V1 MVP should include:

1. Project onboarding
   - Initialize `.notch/`
   - Create config
   - Detect common project metadata where possible
   - Validate installation with `notch doctor`

2. 3Notch Pass
   - Create a lightweight end-of-session handoff
   - Capture current task, changed files, decisions, blockers, next recommended actions, and confidence
   - Support manual authoring and AI-agent generated passes
   - Retrieve latest pass for a new agent session

3. 3Notch Brief
   - Create targeted handoff documents for a specific future task or agent
   - Include selected context, design basis, prior reasoning, relevant files, constraints, and explicit exclusions
   - Support examples like:
     - “Here is the March implementation basis for feature X”
     - “Here is the package of skill files relevant to this debugging task”
     - “Here is what Codex needs before modifying this module”
   - Store briefs as durable local artifacts
   - List and retrieve briefs by ID, title, tags, and target agent

4. 3Notch Status
   - Summarize current 3Notch project state
   - Show latest pass, open briefs, unresolved decisions, stale handoffs, and validation issues

5. 3Notch Doctor
   - Validate `.notch/` structure
   - Validate schemas
   - Detect corrupted or stale records
   - Report actionable fixes

6. MCP Server
   - Expose 3Notch functionality to AI agents through MCP tools
   - Include tools for creating passes, reading latest pass, creating briefs, listing briefs, reading briefs, checking status, and validating the store
   - Keep write operations constrained and auditable

7. Documentation/Demo
   - Provide a clean README path from install to first pass
   - Include demo fixtures showing Claude-to-Codex or agent-to-agent handoff
</v1_scope>

<explicit_non_goals>
The V1 MVP should not include:
- Hosted SaaS
- Multi-user cloud sync
- Billing
- Login/auth
- Web dashboard
- Browser extension
- Deep integrations with every LLM provider
- Automatic ingestion of full Claude/Codex/ChatGPT histories
- Vector database
- Semantic search as a core dependency
- Agent orchestration
- Background daemon unless strongly justified
- Complex plugin marketplace
- Enterprise policy controls
</explicit_non_goals>

Produce a TECHNICAL SPECIFICATION in this exact format:

---

## Technical Specification: 3Notch V1 MVP

### Recommended Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | [choice] | [why] |
| Language | [choice] | [why] |
| CLI Framework | [choice] | [why] |
| Local Storage | [choice] | [why] |
| Schema Validation | [choice] | [why] |
| MCP Server | [choice] | [why] |
| Testing | [choice] | [why] |
| Packaging/Distribution | [choice] | [why] |

### Overview

[2-4 sentences describing the product and what this spec covers.]

### Product Principles

[List the principles that should guide implementation.]

### Architecture Decision

[Explain the chosen architecture. Include why this is a CLI-first/local-first product and why alternatives like SaaS, web dashboard, vector DB, or full agent orchestration are out of scope for V1.]

### V1 Non-Goals

[List what should explicitly not be built.]

### Repository Structure

```text
[Proposed repo/package structure]
```

### Local 3Notch Store Layout

Describe the `.notch/` directory.

```text
.notch/
  config.json
  passes/
  briefs/
  decisions/
  index/
  logs/
```

For each folder/file, explain:
- Purpose
- Whether it is source of truth or derived
- Whether users are expected to edit it manually
- Validation rules

### Data Model

Define the core record types.

#### 3Notch Config

```ts
[TypeScript interface or equivalent]
```

#### 3Notch Pass

```ts
[TypeScript interface or equivalent]
```

#### 3Notch Brief

```ts
[TypeScript interface or equivalent]
```

#### Decision Record

```ts
[TypeScript interface or equivalent]
```

#### Project Status Summary

```ts
[TypeScript interface or equivalent]
```

### File Formats

For each persisted artifact, specify:
- File extension
- Naming convention
- Required fields
- Optional fields
- Example path
- Example content

Include examples for:
- A 3Notch Pass
- A targeted 3Notch Brief
- A Decision Record
- 3Notch config

### Schema Validation

Describe:
- Schema location
- Validation library
- Runtime validation behavior
- Error format
- How schema versions are handled
- Migration posture for future versions

### CLI Specification

For each command, provide:
- Purpose
- Usage
- Flags/options
- Interactive behavior
- Non-interactive behavior
- Output format
- Error cases
- Exit codes
- Example invocation

Include at minimum:

#### `notch onboard`

#### `notch pass`

#### `notch brief create`

#### `notch brief list`

#### `notch brief show <id>`

#### `notch status`

#### `notch doctor`

#### `notch mcp serve`

### MCP Tool Specification

Define each MCP tool exposed by 3Notch.

For each tool, include:
- Tool name
- Purpose
- Input schema
- Output schema
- Read/write behavior
- Security boundaries
- Failure modes

Include at minimum:
- `create_pass`
- `get_latest_pass`
- `create_brief`
- `list_briefs`
- `get_brief`
- `get_status`
- `run_doctor`

### Core Services

Describe the internal modules and responsibilities.

Include modules such as:
- Config service
- Store service
- Schema validation service
- Pass service
- Brief service
- Status service
- Doctor service
- MCP adapter
- CLI adapter

For each service, describe:
- File path
- Inputs
- Outputs
- Key functions
- Error handling

### 3Notch Pass Behavior

Specify exactly how a pass is created, stored, validated, and retrieved.

Include:
- Required fields
- Optional fields
- Human-authored vs agent-authored behavior
- Latest-pass resolution
- Staleness detection
- Example pass

### 3Notch Brief Behavior

Specify exactly how targeted briefs work.

Include:
- How a user or agent creates one
- How scope is declared
- How exclusions are declared
- How relevant files are referenced
- How historical reasoning is summarized
- How another agent retrieves and uses it
- How briefs differ from passes
- Example brief

### Status and Doctor Behavior

Specify:
- What `notch status` reports
- What `notch doctor` validates
- What makes a 3Notch store healthy, stale, invalid, or corrupted
- Suggested fix output format

### Security and Privacy Considerations

Address:
- Local-first privacy model
- No telemetry default
- Safe MCP boundaries
- Avoiding accidental secret capture
- Handling sensitive file references
- Redaction strategy
- Trust model for AI-generated handoffs

### Error Handling

Define:
- Error object shape
- CLI error display format
- MCP error response format
- Common error codes
- Recovery guidance

### Testing Strategy

Provide a testing checklist covering:
- Unit tests
- Schema validation tests
- CLI command tests
- MCP tool tests
- Fixture-based tests
- Corrupt store tests
- Snapshot/golden output tests
- Cross-platform path tests

### Acceptance Criteria

Define what must be true for V1 to be considered complete.

Include:
- Install works
- Onboarding creates valid `.notch/`
- Pass creation and retrieval work
- Brief creation/listing/showing work
- MCP server exposes expected tools
- Doctor catches invalid records
- README demo works from a fresh clone
- No cloud dependency
- No telemetry
- Tests pass

### Future Considerations

List useful post-V1 ideas from the project files that should not be implemented in V1.

### Open Questions

List only questions that genuinely affect implementation. Do not ask broad product-strategy questions that can be reasonably decided from the project request.
