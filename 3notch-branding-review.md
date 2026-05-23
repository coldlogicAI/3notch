# Branding And Product Design Review: 3Notch

## Executive Recommendation

The product should launch under the working brand **3Notch**, with `notch` as the CLI command, `@3notch/cli` as the intended npm package, and `.notch/` as the local project store.

The brand should not lead with "memory." That market is already crowded and abstract. The sharp value is continuity, clean handoffs, and reducing copy-paste between agents.

Recommended public framing:

> 3Notch leaves a trail the next agent can follow.

Recommended launch tagline:

> When Claude stops, Codex starts with the right context.

Recommended category:

> Local-first context passing for AI agents.

## Naming

### Best Current Name

**3Notch**

Why it works:

- It has a real origin story: Three Notch'd Road was marked so the next traveler could stay on the route.
- It is more distinctive than generic relay, memory, or context names.
- It avoids crowded "memory" language.
- It creates a visual system: three cuts, a trail mark, a compact terminal glyph.
- It gives the product a memorable hook while the tagline explains the job.

Weakness:

- It does not explain the product by itself.
- The numeric brand needs consistent styling.
- It requires formal trademark and domain clearance before public launch.

Use the historical spelling **Three Notch'd Road** only in origin copy. Do not use `Notch'd`, `notchd`, or apostrophes in the product name, CLI, package, or domain.

### Best CLI Name

**notch**

Why it works:

- Short enough to type.
- Matches the brand without forcing a numeric command.
- Reads cleanly in the terminal: `notch brief`, `notch pass`, `notch doctor`.
- Supports product language such as "leave a notch" and "check the latest pass."

Alternative CLI names:

- `3notch`
- `mark`
- `trail`
- `waymark`
- `pass`
- `ctx`

Avoid:

- `memory`
- `brain`
- `mesh`
- `hive`
- `agentos`
- anything that sounds like a platform before the v1 is useful.

### Naming Architecture

Use:

- Product: 3Notch
- CLI binary: `notch`
- npm package: `@3notch/cli`
- Local folder: `.notch/`
- Core object: pass
- Startup object: brief
- Health object: status

Example:

```bash
npx @3notch/cli onboard
notch brief
notch pass
notch status
notch doctor
```

## Positioning

### Primary Positioning

3Notch is a local-first tool for leaving project context marks that AI agents can follow.

### Short Pitch

Stop copy-pasting context between AI tools. 3Notch gives every agent the same project brief, recent passes, decisions, open questions, and stale-context warnings.

### Longer Pitch

3Notch is a local-first CLI and MCP server that lets Claude, Codex, Cursor, ChatGPT, and local agents share structured project context without exposing full private chat histories. Agents read a compact brief before they start and write a pass before they stop, so the next agent can continue correctly.

3Notch also supports targeted briefs: deliberate, scoped handoff documents for a specific future task or agent.

### Origin Story

3Notch takes its name from Three Notch'd Road, a colonial-era route marked by three notches cut into trees to blaze the trail. The product does the same for AI work: it leaves compact, source-linked marks so the next agent can continue without rebuilding context.

Keep the origin story short and concrete. It should support the brand, not become the whole pitch.

### Availability Notes

Current working assumptions from the bootstrap naming check:

- `3notch` and `@3notch/cli` were not found on npm during the check.
- `notch` exists on npm as an old CouchApps CLI package, so publish under the scoped package and use `notch` only as the binary.
- GitHub user/org/repo lookups for `3notch` returned not found during the check.
- `3notch.com` is occupied by Three Notch Group.
- The user found `3notch.ai` available for purchase during this session.
- There are existing names around Three Notch'd Road and Three Notch'd Brewing; these appear adjacent to the origin story rather than direct software overlap, but formal trademark clearance is still required before public launch.

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

3Notch is a local-first CLI and MCP server for passing project briefs, targeted task context, decisions, open questions, and implementation summaries between AI agents.

### Primary CTA

```bash
npx @3notch/cli onboard
```

### Secondary CTA

View the Claude to Codex demo

### Three Proof Bullets

- Read the same project brief before work starts.
- Create targeted briefs for specific tasks.
- Write a pass before work ends.
- Keep decisions, questions, stale assumptions, and conflicts visible.

## README Hero

Recommended top of README:

```md
# 3Notch

When Claude stops, Codex starts with the right context.

3Notch is a local-first CLI and MCP server for passing project context between AI agents. It gives every agent the same project brief, recent passes, active decisions, open questions, stale assumptions, and conflict warnings without sharing full chat histories.

```bash
npx @3notch/cli onboard
notch brief
notch brief create --title "March training feature" --to codex
notch pass
notch mcp serve
```

## Why

AI work now happens across Claude, Codex, Cursor, ChatGPT, and local agents. Each tool remembers different things. 3Notch creates one local project context that agents can read before they start and update before they stop.
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

**three notches / trail mark / pass / packet**

Use a simple symbolic visual:

```text
Claude -> brief -> Codex
```

Or:

```text
[agent] --notch--> [agent]
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

- three short angled cuts;
- a trail blaze rendered as three marks;
- a terminal prompt paired with three notches;
- two cursors with a small trail mark between them;
- a compact `3Notch` wordmark.

Do not over-invest in the logo before the demo works.

## Product Design

### First-Run Experience

The first run should be guided:

```bash
npx @3notch/cli onboard
```

Ideal output:

```text
3Notch

Found Git repo: my-app
Create local context store at .notch/? yes
Create starter brief? yes
Configure MCP for Claude Desktop? yes

Ready.

Next:
  notch brief
  notch pass
  notch mcp serve
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

`notch status` should be one of the best-designed commands.

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

`notch brief` should be compact, not a dump.

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

`notch brief create` should produce a scoped handoff document, not a full memory dump.

Recommended shape:

```text
3Notch Brief: March Training Feature

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

`notch pass` should be easy for humans and agents.

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
notch pass --from codex --summary "Implemented route guard" --files src/middleware.ts
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
   - 3Notch writes pass
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
   - stored in `.notch/`;
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
npx @3notch/cli onboard
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
notch brief
```

Shows Claude's plan.

### Scene 4

Codex reads brief and implements.

### Scene 5

Codex writes pass.

### Scene 6

Terminal:

```bash
notch status
```

Shows recent pass, open question, no conflicts.

End card:

> No copy-paste. No shared chat history. Just the right context.

## Pricing/Commercial Brand

The OSS product should feel complete. The commercial layer should feel like convenience and collaboration.

Commercial name options:

- 3Notch Cloud
- 3Notch Sync
- 3Notch Teams

Avoid making the OSS README feel like crippleware. The hosted layer should be:

- encrypted sync;
- team workspaces;
- managed MCP endpoint;
- browser UI;
- admin/audit;
- connector setup.

Public sentence:

> 3Notch is local-first and open source. Hosted sync and team workspaces are planned for users who want shared context across devices and teams.

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
3. Add `notch brief` and `notch pass` as the two hero commands everywhere.
4. Keep "memory" mostly in technical sections.
5. Make "doctor" and "status" part of the MVP, not nice-to-have.

## Final Brand Read

This should be marketed as a pragmatic developer tool, not an AI platform.

The emotional hook:

> I should not have to explain the same project to five different agents.

The functional hook:

> Every agent reads the brief before work and writes a pass after work.

The trust hook:

> Local files. Human-readable. No cloud unless you turn it on.

The launch wedge:

> Claude to Codex pass in five minutes.
