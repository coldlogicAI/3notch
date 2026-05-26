# 3Notch

**Your AI tools will change. Your project context should not have to.**

[**Website →**](https://3notch.dev) · [**Docs →**](https://3notch.dev/docs/) · [**Quickstart →**](https://3notch.dev/docs/quickstart/) · [**npm →**](https://www.npmjs.com/package/@3notch/cli)

[![CI](https://img.shields.io/github/actions/workflow/status/coldlogicAI/3notch/ci.yml?branch=main&style=flat-square)](https://github.com/coldlogicAI/3notch/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@3notch/cli?style=flat-square)](https://www.npmjs.com/package/@3notch/cli)
[![Node](https://img.shields.io/node/v/@3notch/cli?style=flat-square)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)

3Notch is a local-first CLI and MCP server for moving explicit, reviewable context between repos and AI tools. You are already the bus for your AI context — copying summaries between Claude, Codex, Cursor, ChatGPT, terminals, repos, and new projects. 3Notch is the local packet layer for the context you meant to carry by hand.

No cloud service. No account. No telemetry. No vector database. No hidden chat scraping. No remote connector.

---

## Quickstart

Install once:

```bash
npm install -g @3notch/cli
notch onboard
```

Onboard creates `.notch/README.md` so local agents have a durable place to learn the project handoff rules. The default next step is to ask your agent to read `.notch/README.md`, explain its understanding, and then create or inspect packets as needed. Use `notch prompt` only for web chats or copy-paste setup when an agent cannot read local files.

Then pick the flow that matches your situation.

### 1. Bundle files for another tool

When one tool has files the next tool needs, create a packet that carries both intent and bytes:

```bash
notch packet create \
  --title "Brand handoff" \
  --summary "Brand handoff for the launch page." \
  --to-agent codex \
  --to-repo ../brand-site \
  --file mascot.jpg:asset \
  --file showcase.html:source \
  --next-steps "Build apps/brand-site/ using showcase.html as the layout and mascot.jpg in the hero."
```

The packet lands as a folder in `.notch/outbox/` with `packet.md`, `manifest.json`, and copied bytes under `artifacts/`. Copied files keep their project-relative paths, so `src/app/icon.svg` lands at `artifacts/src/app/icon.svg`. The destination imports the folder:

```bash
notch packet import ../source/.notch/outbox/<packet-folder>/packet.md
notch packet preview <packet-id>
```

MCP clients use the same model through `create_packet` with `files`, `refs`, and `nextSteps`.

### 2. Same store, two tools

For one project used from both Claude Code and Claude Desktop, point both clients at the same `.notch/` store:

```bash
notch onboard --yes --mcp claude-code
notch onboard --yes --mcp claude-desktop
```

Both clients now read and write the same store. When one creates a packet, the other can list and read it immediately — no transfer step.

### 3. Cross-repo on one machine

```bash
notch packet create --title "Auth handoff" --summary "Auth context for the API repo." \
  --to-agent codex --to-repo ../api --ref src/auth.ts
notch packet import ../source/.notch/outbox/<packet-file-or-folder>/packet.md
```

Use `--ref` when both repos share the same workspace path. Use `--file` when the destination needs the bytes copied in.

### 4. Cross-machine

Pack the folder into a deterministic `.notchpkt` archive, move it via scp / iCloud / Tailscale / email / git, unpack on the other side:

```bash
notch packet pack <packet-id>
# move <packet-id>.notchpkt to the destination machine
notch packet unpack <packet-id>.notchpkt
```

### 5. Browser-only chats (fallback)

Claude.ai and other web chats can't reach local MCP yet. The fallback is clipboard-mediated:

```bash
notch prompt --client claude-chat
# paste the prompt into the chat, ask for a packet, copy the result
pbpaste | notch packet import -
```

This is an escape hatch, not a peer of the MCP-native paths. The structurally honest replacement is custom connectors / remote MCP — see [Where We Want Help](#where-we-want-help).

### 6. Personal capture

When you just want to remember something for yourself:

```bash
notch mark --summary "Decided to keep browser auth cookie-based" --tags auth
```

---

## How The Handoff Model Works

The loop is explicit and reviewable:

1. A user asks an AI client or CLI session to package selected context.
2. The client supplies a summary, source links, exclusions, recipient metadata, and next steps through CLI or MCP.
3. 3Notch validates the record, scans it for secrets, and writes a Markdown packet under `.notch/outbox/` or `.notch/private/`.
4. The user previews the packet before another tool or repo relies on it.
5. Another repo can import the packet, or another tool can read it directly when both clients share the same store.

Targeting fields (`--to-agent`, `--to-person`, `--to-repo`) answer "who is this packet for?" They are routing and review metadata. They are not identity, authentication, or delivery controls — your existing transport (scp, rsync, iCloud, Tailscale, email, git) moves the bytes.

## Core Commands

```text
notch onboard                       initialize .notch/, .notch/README.md, and MCP setup
notch packet create                 create a packet (--file, --ref, --next-steps)
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

## Repo Structure

```
src/                  CLI, core services, MCP server, schemas, types
tests/                unit, CLI, MCP, schema, e2e tests + fixtures
fixtures/             demo .notch/ stores used by docs and e2e tests
docs/                 guides, reference, agent prompts, archived plans
.github/              CI workflow, issue templates, PR template
```

For the internal architecture (record types, store layout, services), see [docs/archived-plans/v1/3notch-v1-technical-spec.md](docs/archived-plans/v1/3notch-v1-technical-spec.md) — it is still the authoritative spec.

## Docs

Full index: [docs/README.md](docs/README.md).

| Goal | Doc |
| --- | --- |
| Move context between repos | [docs/guides/cross-repo-packets.md](docs/guides/cross-repo-packets.md) |
| Move context between tools | [docs/guides/cross-tool-handoff.md](docs/guides/cross-tool-handoff.md) |
| Carry preferences into a new repo | [docs/guides/private-context-seeding.md](docs/guides/private-context-seeding.md) |
| Brief an agent on scoped work | [docs/guides/targeted-brief-workflow.md](docs/guides/targeted-brief-workflow.md) |
| Set up MCP clients | [docs/guides/mcp-setup.md](docs/guides/mcp-setup.md) |
| Understand privacy posture | [docs/reference/privacy.md](docs/reference/privacy.md) |
| Understand the security model | [docs/reference/security-story.md](docs/reference/security-story.md) |
| Use the web-chat bridge | [docs/prompts/web-chat-to-project.md](docs/prompts/web-chat-to-project.md) |

## Boundaries

3Notch is deliberately narrow.

- Local-first files by default. No cloud dependency, no hosted relay, no account system.
- No telemetry.
- No hidden chat or project scraping.
- No semantic derivation, auto-tagging, similarity threading, contradiction flagging, wiki UI, graph view, hosted sync, or cross-store aggregation.
- No arbitrary shell execution through MCP.
- No SQLite or native database dependency.
- No transport verbs (`send`, `pass`). Your existing tools move bytes; 3Notch validates, scans, and stores them.
- No `decision`, `question`, `conflict`, or `stale` record types. Same-repo continuity is solved by CLAUDE.md, native tool memory, and `git commit`.

A regression-guard test (`tests/unit/no-deferred-commands.test.ts`) prevents accidental re-introduction.

## Where We Want Help

3Notch is open source because the cross-vendor handoff problem can only be solved neutrally. These are known gaps where contributor input is welcome:

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
- **Reply-surfacing UX patterns.** V2 shipped the schema (`replyTo`, `replyType`, `status`); the surfacing layer is deferred so contributors can experiment.
- **Wiki / browse / graph views** over `relationships.json`. Out of OSS core by design; contributor surfaces welcome.
- **Additional `notch check` rules** — contribute once you've hit the pain.

**Hardening**
- **Encryption at rest** for `.notch/private/`.
- **Scanner rule contributions** — org-specific, industry-specific, or platform-specific patterns.

If you're considering a contribution, open an issue first so we can align on the OSS-core / contributor-ecosystem boundary.

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
