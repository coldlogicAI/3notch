# 3Notch

**Save the working state your AI tools won't.**

[Website](https://3notch.dev) · [Docs](https://3notch.dev/docs/) · [Quickstart](https://3notch.dev/docs/quickstart/) · [npm](https://www.npmjs.com/package/@3notch/cli)

[![CI](https://img.shields.io/github/actions/workflow/status/coldlogicAI/3notch/ci.yml?branch=main&style=flat-square)](https://github.com/coldlogicAI/3notch/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@3notch/cli?style=flat-square)](https://www.npmjs.com/package/@3notch/cli)
[![Node](https://img.shields.io/node/v/@3notch/cli?style=flat-square)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)](LICENSE)

Rate limits, model failures, context compaction, tool switches — the code is still in git. The objective, decisions, and next steps often are not. The next session rebuilds that state from scratch.

3Notch is a **local CLI and MCP server** for:

- **Continuation checkpoints** — when Claude Code is configured, recover after rate limits, model-down failures, and compaction
- **Portable packets** — hand off selected work across tools, repos, and machines
- **Durable inbox** — async delivery between stores that share a mailbox root

No cloud service. No account. No telemetry. Records stay on disk as Markdown (and optional artifacts) under `.notch/`.

---

## Install

```bash
npm install -g @3notch/cli
notch onboard
```

Agent prompt (optional):

> Install @3notch/cli, run `notch onboard` in this repo, and set up continuation checkpoints if I use Claude Code. Use packets for handoffs across tools or repos. Read the package README before changing MCP config.

---

## Common flows

### Resume after a failed session

With [continuation checkpoints](docs/guides/continuation-checkpoints.md) enabled for Claude Code, 3Notch can write a fallback from task state and git when the session hits a rate limit, model-down failure, or compaction. The next session may offer that checkpoint once; you approve before it is loaded.

```bash
notch packet list
notch packet preview <id>
```

### Hand off between tools

```bash
notch packet create \
  --title "Auth refactor checkpoint" \
  --summary "Token validation done; session store migration blocked." \
  --next-steps "Implement Redis session adapter"

notch packet preview <id>
# other tool / session imports and continues
```

### Ship files to another repo or machine

```bash
notch packet create \
  --title "Brand handoff" \
  --summary "Assets and layout for the launch page." \
  --file mascot.jpg:asset \
  --file showcase.html:source \
  --next-steps "Build the launch page from showcase.html and mascot.jpg."

notch packet pack <id>
# move <id>.notchpkt however you prefer, then:
notch packet unpack <id>.notchpkt
```

### Async agents — durable inbox

Both sides register the same mailbox root, then pack/send and pull/ack:

```bash
notch inbox init --name review-agent --root /shared/3notch-mailbox
notch packet pack <id>
notch send <id>.notchpkt --to local:review-agent
# forward the printed delivery notice via chat, Slack, etc.

notch inbox list
notch inbox pull <delivery-id> --import
notch inbox ack <delivery-id>
```

`local:` addresses are routing labels, not authenticated identity. See [Durable inbox](docs/guides/durable-inbox.md).

### Web chat without MCP

```bash
notch prompt --client claude-chat
# paste into the chat, copy the packet back
pbpaste | notch packet import -
```

### Personal capture

```bash
notch mark --summary "Keep browser auth cookie-based" --tags auth
```

---

## How it works

1. You or an agent write selected context through the CLI or MCP tools.
2. 3Notch validates, secret-scans, and stores records under `.notch/`.
3. Preview before another agent relies on the content.
4. The next session, tool, or store imports or resumes from that record.

Targeting fields (`--to-agent`, `--to-repo`) are intent metadata. Bytes move via your transport (scp, git, AirDrop, Tailscale) or the durable inbox mailbox — not a 3Notch-hosted relay.

---

## Commands

```text
notch onboard                         initialize .notch/ and MCP setup
notch packet create                   create a packet (--file, --ref, --next-steps)
notch packet import <path>            import into .notch/inbox/
notch packet preview <id>             show what an agent will read
notch packet pack / unpack            .notchpkt archive round-trip
notch packet list / show              list / inspect packets
notch inbox init/list/status/pull/ack durable delivery lifecycle
notch send <archive> --to <address>   send a packed project handoff
notch reply <id>                      typed reply to a packet
notch mark                            self-addressed private capture
notch brief / brief create|list|show  scoped task briefs
notch seed from <path>                private context seeding
notch prompt --client <client>        agent / web-chat instruction packs
notch scan <file-or-stdin>            secret scanner
notch check                           structural corpus checks
notch doctor                          store diagnostics
notch status                          store summary
notch mcp serve                        local stdio MCP server
```

---

## MCP

`notch mcp serve` over local stdio:

| | Tools |
| --- | --- |
| **Read** | `get_brief`, `list_briefs`, `get_targeted_brief`, `get_packet`, `list_packets`, `list_inbox`, `get_inbox_delivery`, `get_status`, `check_store`, `run_doctor` |
| **Write** | `create_brief`, `create_packet`, `create_mark`, `create_reply`, `create_seed_packet`, `import_packet`, `import_seed_packet`, `inbox_init`, `send_packet`, `pull_inbox_packet`, `ack_inbox_delivery` |

Private records under `.notch/private/` stay hidden unless the server starts with `--include-private`. Client setup: [docs/guides/mcp-setup.md](docs/guides/mcp-setup.md).

---

## Documentation

| Topic | Guide |
| --- | --- |
| Index | [docs/README.md](docs/README.md) |
| Cross-repo packets | [docs/guides/cross-repo-packets.md](docs/guides/cross-repo-packets.md) |
| Cross-tool handoff | [docs/guides/cross-tool-handoff.md](docs/guides/cross-tool-handoff.md) |
| Durable inbox | [docs/guides/durable-inbox.md](docs/guides/durable-inbox.md) |
| Continuation checkpoints | [docs/guides/continuation-checkpoints.md](docs/guides/continuation-checkpoints.md) |
| MCP setup | [docs/guides/mcp-setup.md](docs/guides/mcp-setup.md) |
| Privacy | [docs/reference/privacy.md](docs/reference/privacy.md) |
| Security | [docs/reference/security-story.md](docs/reference/security-story.md) |
| Releases (maintainers) | [docs/guides/release.md](docs/guides/release.md) |

Website docs mirror: [https://3notch.dev/docs/](https://3notch.dev/docs/).

---

## Boundaries

- Local files by default — no hosted relay, account system, or telemetry
- No vector DB / native DB dependency
- No arbitrary shell execution through MCP
- You move bytes; 3Notch validates, scans, hashes, and stores them

Regression guard: `tests/unit/no-deferred-commands.test.ts`.

---

## Contributing

Prefer opening an issue before large features. See open issues and [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
git clone https://github.com/coldlogicAI/3notch.git
cd 3notch
npm install
npm run lint && npm run type-check && npm run build
npm test && npm run test:e2e
npm run release:check
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

Architecture reference (historical but still useful): [docs/archived-plans/v1/3notch-v1-technical-spec.md](docs/archived-plans/v1/3notch-v1-technical-spec.md).

---

## License

[MIT](LICENSE) © 3Notch contributors
