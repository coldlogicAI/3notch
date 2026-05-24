---
id: packet_20260523T174000Z_claude_desktop_session_handoff
schemaVersion: "1.0.0"
recordType: packet
status: active
title: Claude Desktop selected session handoff
purpose: handoff
sensitivity: project
transferStatus: outbox
origin:
  projectName: claude-desktop-session
  storePath: local-mcp-session
recipient:
  targetAgent: codex
summary: Claude Desktop supplied a selected summary for implementation in another local tool.
includedRecords: []
includedSourceLinks:
  - kind: url
    url: https://example.invalid/selected-session-note
    label: selected session note
importNotes: Use only the selected summary and listed exclusions.
createdAt: 2026-05-23T17:40:00Z
createdBy:
  actorType: agent
  name: Claude Desktop
sourceTool:
  name: claude
  client: desktop
tags: [cross-tool, demo]
sourceLinks: []
reviewStatus: unreviewed
---

## Summary

Claude Desktop supplied a selected summary for implementation in another local tool.

## Recipient

Codex or another local MCP-capable agent.

## Origin

Claude Desktop session context selected by the user.

## Included Context

- Selected summary only.

## Source Links

- https://example.invalid/selected-session-note

## Import Notes

Use only the selected summary and listed exclusions.
