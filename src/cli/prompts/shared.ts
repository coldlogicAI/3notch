export type PromptClientId = 'claude-chat' | 'claude-code' | 'claude-desktop' | 'codex' | 'cursor';

export type PromptClient = {
  id: PromptClientId;
  label: string;
  destination: string;
  setupHint: string;
};

export const v1McpToolNames = [
  'get_brief',
  'create_brief',
  'list_briefs',
  'get_targeted_brief',
  'create_packet',
  'import_packet',
  'list_packets',
  'get_packet',
  'create_seed_packet',
  'import_seed_packet',
  'create_mark',
  'create_reply',
  'check_store',
  'get_status',
  'run_doctor',
] as const;

export function renderAgentPrompt(client: PromptClient): string {
  if (client.id === 'claude-chat') {
    return renderClaudeChatPrompt(client);
  }

  return `3Notch Agent Instructions - ${client.label}

Place this in: ${client.destination}

${client.setupHint}

When the user asks to package, transfer, or hand off project context, use the local 3Notch MCP server. Work from explicit user-provided context, selected files, source links, and summaries. Do not claim access to hidden chat history or private files the user did not provide.

Use packets for cross-tool or cross-repo handoff:
- Call create_packet when the user wants context prepared for another agent, repo, or person.
- Include a concise summary, recipient metadata, sourceLinks, exclusions, and next steps.
- Call list_packets and get_packet when the user asks to inspect available packets.
- Call import_packet only for a packet path the user explicitly selected.

Use briefs for scoped work:
- Call get_brief before broad project work.
- Call create_brief for a targeted task brief.
- Call list_briefs and get_targeted_brief to find existing briefs.

Use private seed packets only for reviewed user preferences and workflow conventions:
- Call create_seed_packet only with explicit private context supplied by the user.
- Call import_seed_packet only for a user-selected private seed packet path.
- When the user wants to remember something for themselves, such as a decision, finding, or thought, call create_mark.

Use status checks when helpful:
- Call check_store for deterministic corpus integrity findings.
- Call get_status for a store summary.
- Call run_doctor for diagnostics.

Available 3Notch MCP tools:
${v1McpToolNames.map((tool) => `- ${tool}`).join('\n')}`;
}

function renderClaudeChatPrompt(client: PromptClient): string {
  return `3Notch Claude Chat Packet Bridge - ${client.label}

Place this in: ${client.destination}

${client.setupHint}

You are helping the user carry selected project context back into their local 3Notch store. Keep track of the project context the user explicitly gives you in this conversation. When the user asks for a 3Notch packet, emit one self-contained Markdown document with YAML frontmatter and the required packet body headings.

Use this packet shape:

---
id: packet_YYYYMMDDTHHMMSSZ_short_context_name
schemaVersion: "1.0.0"
recordType: packet
status: active
title: Short context name
purpose: seed
sensitivity: private
transferStatus: outbox
origin:
  projectName: claude-chat
  storePath: claude-chat
recipient: {}
summary: One concise paragraph of selected context.
includedRecords: []
includedSourceLinks: []
createdAt: YYYY-MM-DDTHH:MM:SSZ
createdBy:
  actorType: agent
  name: Claude Chat
sourceTool:
  name: claude
  client: claude-chat
tags: []
sourceLinks: []
reviewStatus: unreviewed
---

## Summary

One concise paragraph of selected context.

## Recipient

The user's local project inbox.

## Origin

Claude Chat conversation.

## Included Context

- None.

## Source Links

- None.

## Import Notes

Review before use.

## User Preferences

- Add only user-approved private preferences when relevant.

## Workflow Conventions

- Preserve only explicit instructions from this conversation.

## Lessons From Prior Work

- Summarize durable lessons the user asked to carry forward.

## What Not To Carry Forward

- Do not include hidden chat history, secrets, or unrelated transcript text.

After you emit the packet, tell the user to copy the entire packet and run one of these commands:
- macOS: pbpaste | notch packet import -
- Linux: xclip -selection clipboard -o | notch packet import -
- PowerShell: Get-Clipboard | notch packet import -

When the user is done with the conversation, they can say: give me a 3Notch packet for this project.`;
}
