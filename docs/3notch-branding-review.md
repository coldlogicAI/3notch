# Branding And Product Design Review: 3Notch

## Executive Recommendation

The product launches as **3Notch**, with `notch` as the CLI command, `@3notch/cli` as the npm package, and `.notch/` as the local project store.

The brand does not lead with "memory." That market is crowded and abstract. The sharp value is **tool-portable, source-linked context packets**: moving the right context from one repo, AI tool, or prior project into the next without copy-paste or vendor lock-in.

Recommended public framing:

> Your AI tools will change. Your project context shouldn't have to.

Alternate framings worth A/B testing:

> When work moves repos, the right context moves with it.

> Tool-portable context for the multi-agent era.

Recommended category:

> Local-first context packets for AI agents.

## Product Direction

3Notch is positioned around a concrete before/after:

**Before:**

> I copy and paste between Claude Desktop, Claude Code, Codex, planning repos, implementation repos, marketing assets, prior client work, and notes.

**After:**

> I create a reviewed context packet from this project/session, then make it available to the next tool or repo.

The mechanics are part of the brand promise:

- CLI core for local packets: `notch seed from`, `notch packet create`, `notch packet import`.
- Local MCP server so Claude Desktop, Claude Code, Codex, Cursor, and other clients can read/write packets explicitly.
- Claude Desktop DXT as the likely later packaging layer for easier local install.
- Remote connector only later, for a hosted/team product with a different trust model.

The privacy line is positive, not defensive: 3Notch is explicit, local, and reviewable. It does not need hidden access to raw chat logs or Claude Project internals because the active agent supplies selected context through a user-invoked tool call.

## Vendor-Neutrality Story

The strategic position is Switzerland. Anthropic will not ship "easily move your context to Codex." OpenAI will not ship "easily move to Claude." Cursor will not ship "easily move to Windsurf." Every incumbent has structural anti-incentive to solve cross-tool portability. A neutral, locally-owned packet format is the only place this problem can be solved cleanly.

Same shape as Tailscale (doesn't compete with cloud providers, integrates with all), 1Password (works across every OS), early Stripe (didn't compete with banks, sat between them). Switzerland plays survive incumbents and tend to compound as the surrounding market fragments.

## Naming

### Product Name

**3Notch**

Why it works:

- Real origin: Three Notch'd Road was marked so the next traveler could stay on the route.
- Distinctive vs generic relay/memory/context names.
- Avoids crowded "memory" language.
- Creates a visual system: three cuts, a trail mark, a compact terminal glyph.
- Memorable hook; the tagline does the explaining.

Weaknesses:

- Does not explain the product by itself.
- Numeric brand needs consistent styling.
- Requires formal trademark and domain clearance before public launch.

Use historical spelling **Three Notch'd Road** only in origin copy. Do not use `Notch'd`, `notchd`, or apostrophes in the product name, CLI, package, or domain.

### CLI Name

**notch**

Why it works:

- Short enough to type.
- Matches the brand without forcing a numeric command.
- Reads cleanly in the terminal: `notch packet create`, `notch seed from`, `notch brief`.
- Supports product language like "leave a notch" and "pick up the next notch."

Avoid: `memory`, `brain`, `mesh`, `hive`, `agentos`, anything that sounds like a platform before V1 is useful.

### Naming Architecture

- Product: 3Notch
- CLI binary: `notch`
- npm package: `@3notch/cli`
- Local folder: `.notch/`
- Core artifact: packet
- Bootstrap artifact: seed packet
- Task-scope artifact: brief
- Cold-start primer: project brief (`.notch/brief.md`)
- Health: status, doctor

Example:

```bash
npx @3notch/cli onboard
notch seed from ../old-project --include preferences --review
notch packet create --to-agent claude --summary "Current shipped features"
notch packet import ../source-app/.notch/outbox/<packet>.md
notch brief
notch status
notch mcp serve --include-private
```

### Availability Notes

Bootstrap naming check assumptions:

- `3notch` and `@3notch/cli` were not found on npm during the check.
- `notch` exists on npm as an old CouchApps CLI package; publish under the scoped package and use `notch` only as the binary.
- GitHub user/org/repo lookups for `3notch` returned not found during the check.
- `3notch.com` is occupied by Three Notch Group.
- `3notch.ai` was available for purchase during the session.
- Existing names around Three Notch'd Road and Three Notch'd Brewing appear adjacent to the origin story rather than direct software overlap. Formal trademark clearance still required before public launch.

## Positioning

### Primary Positioning

3Notch is a local-first CLI and MCP server for moving project context across boundaries that built-in AI tooling cannot cross — across repos, across AI work surfaces, and into new projects.

### Short Pitch

Stop copy-pasting context between repos and AI tools. 3Notch packages selected, source-linked context into inspectable packets the next repo or agent can import. Your tools will change; your context shouldn't have to.

### Longer Pitch

3Notch is a local-first CLI and MCP server that lets Claude Desktop, Claude Code, Codex, Cursor, ChatGPT, and local agents move structured project and private workflow context across repos and AI work surfaces without sharing full chat histories. A user can seed a new repo from prior work, ask Claude Code to create a packet from current repo state, import it into a Claude Desktop session for marketing copy work, or hand it off to Codex in another repo for implementation. Every artifact is a Markdown file the user owns and can inspect.

### Origin Story

3Notch takes its name from Three Notch'd Road, a colonial-era route marked by three notches cut into trees to blaze the trail. The product does the same for AI work: it leaves compact, source-linked marks so the next agent can continue without rebuilding context.

Keep the origin short and concrete. It supports the brand, not the whole pitch.

### Category Design

Do not compete in the generic category:

> AI memory

Create the narrower category:

> tool-portable agent context

The job 3Notch does is more specific than memory and more concrete than handoff: it moves selected context across a boundary built-in tools can't cross.

## Message Hierarchy

### H1

Your AI tools will change. Your project context shouldn't have to.

### Subhead

3Notch is a local-first CLI and MCP server for moving project context across repos, AI tools, and new projects — through inspectable packets you own.

### Primary CTA

```bash
npx @3notch/cli onboard
```

### Secondary CTA

See the Claude Desktop ↔ Claude Code marketing-copy demo.

### Three Proof Bullets

- Seed a new repo with private workflow context from prior work.
- Create a reviewable packet from one tool, import it in another.
- Hand off across repos without copy-paste or chat-history sharing.

## README Hero

```md
# 3Notch

Your AI tools will change. Your project context shouldn't have to.

3Notch is a local-first CLI and MCP server for moving project context across repos, AI tools, and new projects. It packages selected, source-linked context into inspectable Markdown packets that another repo or tool can import.

```bash
npx @3notch/cli onboard
notch seed from ../old-project --include preferences --review
notch packet create --to-agent claude --summary "Current shipped features"
notch packet import ../source-app/.notch/outbox/<packet>.md
notch brief
notch mcp serve --include-private
```

## Why

AI work happens across repos and tools. Each tool's memory layer dies with the tool. CLAUDE.md and `/memory` solve same-tool continuity well; nothing solves cross-tool or cross-repo. 3Notch makes the artifact portable.
```

## Product Personality

The product feels:

- practical;
- calm;
- local-first;
- developer-native;
- trustworthy;
- small and sharp;
- transparent;
- workflow-oriented.

The product does not feel:

- mystical;
- all-knowing;
- like a chatbot;
- like a vector database;
- like enterprise knowledge management;
- like a dashboard-first SaaS;
- like another "AI memory" abstraction.

## Visual Identity

### Direction

Restrained developer-tool identity. Closer to `gh`, `flyctl`, `tailscale`, `mise`, or `uv` than to a broad AI SaaS platform.

### Visual Motif

**three notches / trail mark / packet**

```text
[repo A] --packet--> [repo B]
```

Or:

```text
[claude code] --packet--> [claude desktop]
```

Avoid brain, hive, neural-network, magic, or glowing-orb imagery.

### Color

Quiet, high-contrast:

- near-black text
- off-white background
- one accent color
- terminal green or blue as a restrained accent
- avoid purple-blue AI gradients

Looks like a serious tool, not a generic AI landing page.

### Logo Direction

- three short angled cuts
- a trail blaze rendered as three marks
- a terminal prompt paired with three notches
- two terminal carets with a small trail mark between them
- compact `3Notch` wordmark

Do not over-invest in the logo before the demo works.

## Product Design

### First-Run Experience

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
  notch seed from ../old-project
  notch packet create
  notch brief
  notch mcp serve --include-private
```

### Daily Use Loop

```text
New repo: seed private context from prior work
Work moves repos or tools: create a packet, import in destination
Before agent work: agent reads the brief and any imported packet
For task-scoped context: create a targeted brief
Human checks status when needed
```

Everything else supports that loop.

### Status Output

`notch status` is one of the best-designed commands.

```text
my-app

targeted briefs        2
inbox packets          3
outbox packets         1
private seed packets   1
validation issues      0

Recent inbox
  2026-05-23  Current repo state for marketing copy basis
              from: my-app (commit 4f2c1ab)
  2026-05-22  Auth refactor handoff
              from: planning-repo
```

### Brief Output

`notch brief` is compact, not a dump.

```text
Project Brief: my-app

Current Focus
  Build route guard and onboarding flow.

Active Constraints
  - Use Next.js app router.
  - Keep auth local for V1.

Recent Activity
  - Imported auth refactor packet from planning-repo on 2026-05-22.

Open Threads
  - Hosted sync passkeys vs OTP.

Warnings
  - None.
```

### Targeted Brief Output

`notch brief create` produces a scoped handoff document, not a full memory dump.

```text
3Notch Brief: March Training Feature

Goal For Codex
  Enhance the March training feature using the existing design basis.

Relevant Background
  ...

Prior Reasoning Summary
  ...

Design Basis
  ...

Relevant Files And Sources
  ...

Known Pitfalls
  ...

Recommended Next Steps
  ...
```

V1 stores and retrieves targeted briefs. V1 does not promise automatic historical reconstruction.

### Packet Output

`notch packet show <id>` reads as a complete handoff.

```text
3Notch Packet: Current repo state for marketing copy basis

From      my-app (commit 4f2c1ab, branch main)
To        claude (marketing-author)
Created   2026-05-23 19:20 UTC by Claude Code via MCP

Summary
  Shipped features as of commit 4f2c1ab: route guard, onboarding flow,
  magic-link auth (no passwords yet). Constraint: local auth only,
  no hosted sync.

Source Links
  - src/features/onboarding.ts
  - CHANGELOG.md

Import Notes
  Use this as the source of truth for "what shipped" claims in
  marketing copy. Do not promise hosted sync.
```

## V1 Website Structure

Tool page with a working command near the top — not a generic SaaS page.

1. **Hero**: H1, one-line pitch, install command, demo link.
2. **Demo**: Claude Code creates a packet from current repo state → Claude Desktop imports it → marketing copy stays grounded.
3. **Why a third party**: incumbents won't ship "easily move to a competitor"; vendor-neutral packets are the only way to solve cross-tool context.
4. **What gets stored**: project brief, targeted briefs, inbox/outbox packets, private seed packets.
5. **Local-first privacy**: stored in `.notch/`, human-readable, no cloud unless enabled, private seed packets git-ignored by default.
6. **MCP and CLI**: works with agents through MCP, usable by humans through CLI.
7. **Roadmap**: Claude Desktop DXT, hosted sync waitlist, team workspaces later.

## Demo Script

The first public demo runs under two minutes.

### Scene 1

```bash
npx @3notch/cli onboard
```

### Scene 2

Seed the new repo from prior work:

```bash
notch seed from ../old-project --include preferences --include workflow --review
```

### Scene 3

In Claude Code, ask the agent to create a packet for marketing context:

```text
create_packet({
  title: "Current shipped features",
  toAgent: "claude",
  toPerson: "marketing",
  summary: "Route guard, onboarding flow, magic-link auth shipped at commit 4f2c1ab. Constraint: local auth only.",
  sourceLinks: [{ kind: "file", path: "CHANGELOG.md" }]
})
```

### Scene 4

In Claude Desktop session, import the packet:

```text
import_packet({ packetPath: "/Users/example/my-app/.notch/outbox/<packet>.md" })
```

Or via CLI:

```bash
notch packet import ~/my-app/.notch/outbox/<packet>.md
```

### Scene 5

Claude Desktop writes marketing copy grounded in the imported packet.

### Scene 6

```bash
notch status
```

Shows the new outbox packet on the source side and the import on the destination side.

End card:

> No copy-paste. No shared chat history. Just the right packet.

## Pricing/Commercial Brand

OSS product feels complete. Commercial layer feels like convenience and collaboration.

Commercial name options:

- 3Notch Cloud
- 3Notch Sync
- 3Notch Teams

Avoid making the OSS README feel like crippleware. The hosted layer adds:

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

- packet;
- inbox / outbox;
- seed;
- brief;
- targeted brief;
- import / export;
- carry forward;
- project context;
- source-linked;
- local-first;
- vendor-neutral;
- no copy-paste;
- no full chat-history sharing;
- MCP server;
- CLI.

Avoid:

- pass (deferred from V1; use "packet" or "brief" instead);
- memory (use "context" or "packet");
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

Every feature answers one question:

> Does this help context cross a boundary that built-in tools cannot cross?

If not, defer it. Same-repo same-session continuity is solved by CLAUDE.md, native tool memory, and `git commit`. 3Notch's wedge is cross-boundary transport.

## Final Brand Read

Marketed as a pragmatic developer tool, not an AI platform.

The emotional hook:

> I should not have to re-explain my project to every tool I switch to.

The functional hook:

> Seed a new repo from prior work, create a packet in one repo or tool, import it in another, and let every agent read the right context before work starts.

The trust hook:

> Local files. Human-readable. Vendor-neutral. No cloud unless you turn it on.

The launch wedge:

> Claude Desktop ↔ Claude Code marketing-copy demo in five minutes.
