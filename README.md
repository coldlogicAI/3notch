# 3Notch

**Save the working state your AI tools won't.**

[**Website →**](https://3notch.dev) · [**Docs →**](https://3notch.dev/docs/) · [**Quickstart →**](https://3notch.dev/docs/quickstart/) · [**npm →**](https://www.npmjs.com/package/@3notch/cli)

[![CI](https://img.shields.io/github/actions/workflow/status/coldlogicAI/3notch/ci.yml?branch=main&style=flat-square)](https://github.com/coldlogicAI/3notch/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@3notch/cli?style=flat-square)](https://www.npmjs.com/package/@3notch/cli)
[![Node](https://img.shields.io/node/v/@3notch/cli?style=flat-square)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)

Your AI session died — rate limited, context compacted, model went down. Six hours of decisions, constraints, and working state gone. The next agent starts from scratch because nothing portable survived the switch.

3Notch is a local CLI and MCP server that saves your working state as portable checkpoints. When a session crashes, the next one picks up where you left off. When you switch tools — Claude to Codex, Cursor to ChatGPT — your context travels with you. When work moves to another repo or machine, you package the handoff.

No cloud service. No account. No telemetry. No lock-in. Everything stays on your machine.

---

## Get Started

Give this to your agent:

> Install @3notch/cli and set up context checkpoints for this repo. When a session crashes or I hit a rate limit, save where I was so the next session can pick up. When I switch tools, package the handoff.

Or install directly:

```bash
npm install -g @3notch/cli
notch onboard
```

Then pick the flow that matches your situation.

### Session crashed — pick up where you left off

When a session hits a rate limit or compacts, 3Notch saves your working state automatically. The next session offers to resume:

```bash
notch packet list
# Shows your latest checkpoint with objective, completed work, blockers, and next action
```

### Switching tools — take your context with you

Moving from Claude Code to Codex? The outgoing agent writes a checkpoint. The incoming agent reads it:

```bash
notch packet create \
  --title "Auth refactor checkpoint" \
  --summary "Token validation done, session store migration blocked." \
  --next-steps "Implement Redis session adapter"
```

### Different repo or machine — package the handoff

Bundle selected files, decisions, and next steps into a portable packet:

```bash
notch packet create \
  --title "Brand handoff" \
  --summary "Brand handoff for the launch page." \
  --to-agent codex \
  --to-repo ../brand-site \
  --file mascot.jpg:asset \
  --file showcase.html:source \
  --next-steps "Build the launch page using showcase.html as the layout and mascot.jpg in the hero."
```

The packet lands as a folder in `.notch/outbox/` with `packet.md`, `manifest.json`, and copied bytes under `artifacts/`. The destination imports it:

```bash
notch packet import ../source/.notch/outbox/<packet-folder>/packet.md
notch packet preview <packet-id>
```

### Cross-machine

Pack the folder into a `.notchpkt` archive, move it however you want (scp, iCloud, Tailscale, email, git), unpack on the other side:

```bash
notch packet pack <packet-id>
# move <packet-id>.notchpkt to the destination machine
notch packet unpack <packet-id>.notchpkt
```

### Browser-only chats (fallback)

Web chats that can't reach local MCP use a clipboard bridge:

```bash
notch prompt --client claude-chat
# paste the prompt into the chat, ask for a packet, copy the result
pbpaste | notch packet import -
```

### Personal capture

When you just want to remember something for yourself:

```bash
notch mark --summary "Decided to keep browser auth cookie-based" --tags auth
```

---

## How It Works

Checkpoints and packets are plain Markdown files with structured frontmatter. You can read, edit, and version them like anything else in your repo.

1. You or your agent ask 3Notch to save the current working state.
2. 3Notch validates the record, scans it for secrets, and writes it under `.notch/`.
3. You preview the checkpoint before another tool relies on it.
4. The next session, tool, or repo reads and resumes from it.

Targeting fields (`--to-agent`, `--to-repo`) are routing metadata, not delivery controls — your existing transport moves the bytes.

## Commands

```text
notch onboard                       initialize .notch/ and MCP setup
notch packet create                 create a checkpoint or packet (--file, --ref, --next-steps)
notch packet import <file-or-folder>  import a packet into .notch/inbox/
notch packet preview <id>           show what an agent will read
notch packet pack <id>              produce a .notchpkt archive
notch packet unpack <archive>       import a .notchpkt archive
notch packet list / show            list / inspect packets
notch reply <id>                    typed reply to a packet
notch mark                          self-addressed private capture
notch brief / brief create / list / show   scoped task briefs
notch seed from <path>              private context seeding
notch prompt --client <client>      optional copy-paste agent instruction pack
notch scan <file-or-stdin>          standalone secret scanner
notch check                         deterministic corpus integrity checks
notch doctor                        store diagnostics
notch status                        store summary
notch mcp serve                     local stdio MCP server
```

## MCP

`notch mcp serve` exposes these tools over local stdio:

- Read-only: `get_brief`, `list_briefs`, `get_targeted_brief`, `get_packet`, `list_packets`, `get_status`, `check_store`, `run_doctor`
- Write: `create_brief`, `create_packet`, `create_mark`, `create_reply`, `create_seed_packet`, `import_packet`, `import_seed_packet`

Private records under `.notch/private/` are hidden unless the server starts with `--include-private`. See [docs/guides/mcp-setup.md](docs/guides/mcp-setup.md) for client-specific setup.

## Docs

Full index: [docs/README.md](docs/README.md).

| Goal | Doc |
| --- | --- |
| Move context between repos | [docs/guides/cross-repo-packets.md](docs/guides/cross-repo-packets.md) |
| Move context between tools | [docs/guides/cross-tool-handoff.md](docs/guides/cross-tool-handoff.md) |
| Carry preferences into a new repo | [docs/guides/private-context-seeding.md](docs/guides/private-context-seeding.md) |
| Brief an agent on scoped work | [docs/guides/targeted-brief-workflow.md](docs/guides/targeted-brief-workflow.md) |
| Set up continuation checkpoints | [docs/guides/continuation-checkpoints.md](docs/guides/continuation-checkpoints.md) |
| Set up MCP clients | [docs/guides/mcp-setup.md](docs/guides/mcp-setup.md) |
| Understand privacy posture | [docs/reference/privacy.md](docs/reference/privacy.md) |
| Understand the security model | [docs/reference/security-story.md](docs/reference/security-story.md) |
| Use the web-chat bridge | [docs/prompts/web-chat-to-project.md](docs/prompts/web-chat-to-project.md) |

## Boundaries

3Notch is deliberately narrow.

- Local files by default. No cloud dependency, no hosted relay, no account system.
- No telemetry.
- No vector database or native database dependency.
- No arbitrary shell execution through MCP.
- Your existing tools move bytes; 3Notch validates, scans, and stores them.

A regression-guard test (`tests/unit/no-deferred-commands.test.ts`) prevents accidental scope creep.

## Where We Want Help

3Notch is open source because the cross-vendor context problem can only be solved neutrally. These are known gaps where contributor input is welcome:

**Reaching more surfaces**
- **Web-chat ingest via custom connectors / remote MCP.** An optional HTTP/SSE MCP mode a user wires to Claude.ai via Anthropic's custom-connector flow plus a user-controlled tunnel (Tailscale, Cloudflare). No hosted relay.
- **Onboarding for additional clients** — Gemini CLI, future MCP-capable agents.
- **Mobile / voice intake.**
- **Claude Code → web-chat sharing** (reverse of the current bridge).

**Moving packets between machines and people**
- **Cross-machine transport recipes** for Tailscale, iCloud, Syncthing, git, scp/rsync — opinionated adapter docs.
- **Cross-user / teammate workflows** — conventions for handing packets through whatever channel a team already uses.

**Distribution polish**
- **DXT packaging** for one-click Claude Desktop install.
- **Notarized / signed installers.**

**Capture ergonomics**
- **Agent prompt packs / skills** that wrap "save artifact to disk, then `create_packet`" for specific clients.
- **Per-language / per-framework brief templates.**

**Surfaces on top of the stable substrate**
- **Reply-surfacing UX patterns.** The schema (`replyTo`, `replyType`, `status`) is shipped; the surfacing layer is deferred so contributors can experiment.
- **Wiki / browse / graph views** over `relationships.json`. Out of core by design; contributor surfaces welcome.
- **Additional `notch check` rules** — contribute once you've hit the pain.

**Hardening**
- **Encryption at rest** for `.notch/private/`.
- **Scanner rule contributions** — org-specific, industry-specific, or platform-specific patterns.

If you're considering a contribution, open an issue first so we can align on scope.

## Repo Structure

```
src/                  CLI, core services, MCP server, schemas, types
tests/                unit, CLI, MCP, schema, e2e tests + fixtures
fixtures/             demo .notch/ stores used by docs and e2e tests
docs/                 guides, reference, agent prompts, archived plans
.github/              CI workflow, issue templates, PR template
```

For internal architecture (record types, store layout, services), see [docs/archived-plans/v1/3notch-v1-technical-spec.md](docs/archived-plans/v1/3notch-v1-technical-spec.md).

## Development

```bash
git clone <repo>
cd 3notch
npm install
npm run lint
npm run type-check
npm run build
npm test
npm run test:e2e
node dist/cli/index.js --help
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor loop, including a working cross-repo demo you can run from a fresh clone.

## License

[MIT](LICENSE) © 3Notch contributors
