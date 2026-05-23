# Branding And Product Design Review: Baton

## Executive Recommendation

The product should launch as **Baton** with `baton` as the CLI/package name unless a better short package name is available.

The brand should not lead with "memory." That market is already crowded and abstract. The sharp value is continuity, clean handoffs, and reducing copy-paste between agents.

Recommended public framing:

> Baton helps Claude, Codex, Cursor, ChatGPT, and local agents pick up where each other left off.

Recommended launch tagline:

> When Claude stops, Codex starts with the right context.

Recommended category:

> Local-first context passing for AI agents.

## Naming

### Best Current Name

**Baton**

Why it works:

- It describes the workflow, not the implementation.
- It is understandable in one second.
- It avoids crowded "memory" language.
- It implies a beginning and end to agent work.
- It is compatible with a commercial product later.

Weakness:

- It is descriptive and may be hard to own as a trademark.
- It may be slightly generic for SEO.

### Best CLI Name

**baton**

Why it works:

- Short enough to type.
- Communicates agent context.
- More package-name-friendly than `agent-pass`.
- Can survive a later product rename.

Alternative CLI names:

- `pass`
- `ctx`
- `agentbrief`
- `brief`
- `relay`
- `passoff`

Avoid:

- `memory`
- `mesh`
- `brain`
- `hive`
- `contextos`
- anything that sounds like a platform before the v1 is useful.

### Naming Architecture

Use:

- Product: Baton
- CLI/package: `baton`
- Local folder: `.baton/`
- Core object: pass
- Startup object: brief
- Health object: status

Example:

```bash
npx baton onboard
baton brief
baton pass
baton status
baton doctor
```

## Positioning

### Primary Positioning

Baton is a local-first tool for passing project context between AI agents.

### Short Pitch

Stop copy-pasting context between AI tools. Baton gives every agent the same project brief, recent passes, decisions, open questions, and stale-context warnings.

### Longer Pitch

Baton is a local-first CLI and MCP server that lets Claude, Codex, Cursor, ChatGPT, and local agents share structured project context without exposing full private chat histories. Agents read a compact brief before they start and pass the baton before they stop, so the next agent can continue correctly.

Baton also supports targeted briefs: deliberate, scoped handoff documents for a specific future task or agent.

### Category Design

Do not compete in the generic category:

> AI memory

Create the narrower category:

> agent handoff

Or:

> Agent continuity

This gives the product a more concrete job and a cleaner launch message.

## Message Hierarchy

### H1

When Claude stops, Codex starts with the right context.

### Subhead

Baton is a local-first CLI and MCP server for passing project briefs, targeted task context, decisions, open questions, and implementation summaries between AI agents.

### Primary CTA

```bash
npx baton onboard
```

### Secondary CTA

View the Claude to Codex demo

### Three Proof Bullets

- Read the same project brief before work starts.
- Create targeted briefs for specific tasks.
- Pass the baton before work ends.
- Keep decisions, questions, stale assumptions, and conflicts visible.

## README Hero

Recommended top of README:

```md
# Baton

When Claude stops, Codex starts with the right context.

Baton is a local-first CLI and MCP server for passing project context between AI agents. It gives every agent the same project brief, recent passes, active decisions, open questions, stale assumptions, and conflict warnings without sharing full chat histories.

```bash
npx baton onboard
baton brief
baton brief create --title "March training feature" --to codex
baton pass
baton mcp serve
```

## Why

AI work now happens across Claude, Codex, Cursor, ChatGPT, and local agents. Each tool remembers different things. Baton creates one local project context that agents can read before they start and update before they stop.
```

## Product Personality

The product should feel:

- practical;
- calm;
- local-first;
- developer-native;
- trustworthy;
- small and sharp;
- transparent;
- workflow-oriented.

It should not feel:

- mystical;
- all-knowing;
- like a chatbot;
- like a vector database;
- like enterprise knowledge management;
- like a dashboard-first SaaS;
- like another "AI memory" abstraction.

## Visual Identity

### Direction

Use a restrained developer-tool identity. The product should feel closer to `gh`, `flyctl`, `tailscale`, `mise`, or `uv` than to a broad AI SaaS platform.

### Visual Motif

Recommended motif:

**baton / relay / pass / packet**

Use a simple symbolic visual:

```text
Claude -> brief -> Codex
```

Or:

```text
[agent] --pass--> [agent]
```

Avoid brain, hive, neural-network, magic, or glowing-orb imagery.

### Color

Use a quiet, high-contrast palette:

- near-black text;
- off-white background;
- one accent color;
- terminal green or blue as a restrained accent;
- avoid purple-blue AI gradients.

The product should look like a serious tool, not a generic AI landing page.

### Logo Direction

Simple possibilities:

- two brackets with an arrow: `[ ] -> [ ]`
- a folded note passing through a terminal prompt;
- `ctx>` prompt mark;
- two cursors with a small transfer arrow;
- a compact `baton` wordmark.

Do not over-invest in the logo before the demo works.

## Product Design

### First-Run Experience

The first run should be guided:

```bash
npx baton onboard
```

Ideal output:

```text
Baton

Found Git repo: my-app
Create local context store at .baton/? yes
Create starter brief? yes
Configure MCP for Claude Desktop? yes

Ready.

Next:
  baton brief
  baton pass
  baton mcp serve
```

### Daily Use Loop

The product should teach this loop:

```text
Before work: agent reads brief
For deep context: agent creates or reads a targeted brief
After work: agent writes pass
Human checks status when needed
```

Everything else supports that loop.

### Status Output

`baton status` should be one of the best-designed commands.

Example:

```text
my-app

recent passes   3
Open questions    2
Active decisions  8
Stale assumptions 1
Conflicts         0

Last pass
  codex, 18 minutes ago
  "Implemented auth route guard; needs Claude review on copy."
```

### Brief Output

`baton brief` should be compact, not a dump.

Recommended shape:

```text
Project Brief: my-app

Current Focus
  Build route guard and onboarding flow.

Active Decisions
  - Use Next.js app router.
  - Keep auth local until hosted sync exists.

recent passes
  - Claude planned route guard.
  - Codex implemented middleware.

Open Questions
  - Should hosted sync use passkeys?

Warnings
  - 1 stale assumption: "No auth layer exists."
```

### Targeted Brief Output

`baton brief create` should produce a scoped handoff document, not a full memory dump.

Recommended shape:

```text
Baton Brief: March Training Feature

Goal For Codex
  Enhance/debug the March training feature without revisiting unrelated project history.

Relevant Background
  ...

Design Basis
  ...

Important Decisions
  ...

Relevant Files And Sources
  ...

Known Pitfalls
  ...

Open Questions
  ...

Recommended Next Steps
  ...
```

V1 should store and retrieve targeted briefs. It should not promise automatic historical reconstruction.

### Pass Writer

`baton pass` should be easy for humans and agents.

Interactive mode for humans:

```text
What changed?
What decisions were made?
What remains open?
Which files or sources matter?
Any stale assumptions found?
```

Structured mode for agents:

```bash
baton pass --from codex --summary "Implemented route guard" --files src/middleware.ts
```

## V1 Website Structure

The landing page should not be a generic SaaS page. It should be a tool page with a working command near the top.

Recommended structure:

1. Hero:
   - H1
   - one-line pitch
   - install command
   - demo link

2. Demo:
   - Claude plans
   - Baton writes pass
   - Codex reads brief
   - Codex writes pass

3. Why Not Memory:
   - memory is broad;
   - pass is the job;
   - full chat history is unnecessary.

4. What Gets Stored:
   - brief;
   - targeted briefs;
   - passes;
   - decisions;
   - open questions;
   - stale assumptions;
   - conflicts.

5. Local-First Privacy:
   - stored in `.baton/`;
   - human-readable;
   - no cloud unless enabled.

6. MCP And CLI:
   - works with agents through MCP;
   - usable by humans through CLI.

7. Roadmap:
   - hosted sync waitlist;
   - team workspaces later.

## Demo Script

The first public demo should be under two minutes.

### Scene 1

Show terminal:

```bash
npx baton onboard
```

### Scene 2

Claude writes planning pass or targeted brief:

```text
write_pass(...)
create_brief(...)
```

### Scene 3

Terminal:

```bash
baton brief
```

Shows Claude's plan.

### Scene 4

Codex reads brief and implements.

### Scene 5

Codex writes pass.

### Scene 6

Terminal:

```bash
baton status
```

Shows recent pass, open question, no conflicts.

End card:

> No copy-paste. No shared chat history. Just the right context.

## Pricing/Commercial Brand

The OSS product should feel complete. The commercial layer should feel like convenience and collaboration.

Commercial name options:

- Baton Cloud
- Baton Sync
- Baton Teams

Avoid making the OSS README feel like crippleware. The hosted layer should be:

- encrypted sync;
- team workspaces;
- managed MCP endpoint;
- browser UI;
- admin/audit;
- connector setup.

Public sentence:

> Baton is local-first and open source. Hosted sync and team workspaces are planned for users who want shared context across devices and teams.

## Copy Guidelines

Use:

- pass;
- brief;
- targeted brief;
- continue;
- project context;
- source-linked;
- local-first;
- no copy-paste;
- no full chat-history sharing;
- MCP server;
- CLI.

Avoid:

- brain;
- hive;
- omniscient;
- remembers everything;
- autonomous memory;
- personality;
- AGI;
- self-improving agent memory;
- magic.

## Product Design Rule

Every feature should answer one question:

> Does this help the next agent continue correctly?

If not, defer it.

## Recommended Edits To Main Project Request

The main request is now strong. Remaining possible edits:

1. Consider renaming the file later to `agent-pass-project-request.md`.
2. Replace remaining "context exchange" language in public-facing sections with "pass" or "brief."
3. Add `baton brief` and `baton pass` as the two hero commands everywhere.
4. Keep "memory" mostly in technical sections.
5. Make "doctor" and "status" part of the MVP, not nice-to-have.

## Final Brand Read

This should be marketed as a pragmatic developer tool, not an AI platform.

The emotional hook:

> I should not have to explain the same project to five different agents.

The functional hook:

> Every agent reads the brief before work and passes the baton after work.

The trust hook:

> Local files. Human-readable. No cloud unless you turn it on.

The launch wedge:

> Claude to Codex pass in five minutes.
