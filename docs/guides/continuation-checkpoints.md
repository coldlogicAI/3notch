# Continuation Checkpoints

Continuation checkpoints preserve enough selected project state to resume after a rate limit, context compaction, or an intentional agent switch. They are ordinary immutable packets, not transcripts or hidden memory.

## Enable Claude Code Checkpoints

```bash
notch onboard --yes --mcp claude-code --checkpoints prompt
```

Modes:

- `script`: deterministic hook fallbacks only.
- `prompt`: hook fallbacks plus agent-drafted checkpoints after confirmation.
- `auto`: hook fallbacks plus automatic agent-drafted checkpoints at configured semantic triggers.
- `off`: remove only the 3Notch-owned Claude hooks and disable the workflow.

The default hook set uses `SessionStart`, `TaskCreated`, `TaskCompleted`, `PostCompact`, and `StopFailure:rate_limit`. Add `--checkpoint-stop` only if you accept a hook after every Claude response:

```bash
notch onboard --yes --mcp claude-code --checkpoints prompt --checkpoint-stop
```

`Stop` can produce frequent checkpoints. The installer warns before enabling it.

## What Gets Recorded

Claude task hooks accumulate task IDs, subjects, descriptions, and completion status under ignored `.notch/index/continuation/` state. A five-item structured Claude checklist may produce five task events, but it does not produce five packets.

A packet is written only at a recovery boundary:

- `PostCompact` uses Claude's documented `compact_summary`.
- `StopFailure:rate_limit` uses accumulated tasks and current Git state.
- Optional `Stop` uses the final assistant message, accumulated tasks, and Git state, and deduplicates unchanged state.

Fallback packets include branch, short commit, dirty state, and changed-file names. They never copy file contents or artifacts automatically. Every fallback is marked `unreviewed`, scanned before write, and linked to the previous checkpoint in the same stream with `supersedes`.

## Agent-Drafted Checkpoints

In `prompt` or `auto` mode, Claude receives the configured semantic triggers at session start. A curated checkpoint should preserve:

- Current objective and success criteria.
- Completed work and important decisions.
- Constraints and exclusions.
- Verification already run and its result.
- Blockers, relevant files, exact next action, and what not to redo.

The default triggers are a meaningful milestone, an intentional agent/model switch, and the end of substantial work. Edit `continuation.semanticTriggers` in `.notch/config.json` to match your workflow, then rerun onboarding to verify hook wiring.

## Streams and Resume

The stream is the configured override, current Git branch, detached commit, or `default` for a non-Git project. Continuations use tags such as `continuation`, `stream-feature-auth`, and `source-post-compact`.

At the next session start, 3Notch offers the latest matching checkpoint once. It supplies only packet metadata. Claude must not call `get_packet` or load the packet body until you confirm.

## Privacy Boundary

- Hook scripts never open `transcript_path`.
- Onboarding adds `.claude/settings.local.json` to the project `.gitignore`; backups are kept under ignored `.notch/index/` state.
- `.notch/index/continuation/` is local derived state and gitignored.
- Project checkpoints land in `.notch/outbox/` and may appear in Git; choose `private` sensitivity to use ignored `.notch/private/outbox/`.
- Private mode intentionally adds `--include-private` to this project's 3Notch MCP server so the agent can list and load a checkpoint after you confirm. That server can read other private packets in the same local store through approved MCP calls.
- A rate-limit fallback cannot recover reasoning that was never reflected in a task, Git state, compact summary, final assistant message, or prior curated checkpoint.
- 3Notch never commits, pushes, imports, or transports a checkpoint automatically.
