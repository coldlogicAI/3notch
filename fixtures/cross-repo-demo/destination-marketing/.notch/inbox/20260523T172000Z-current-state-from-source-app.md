---
id: packet_20260523T172000Z_current_state_to_marketing
schemaVersion: "1.0.0"
recordType: packet
status: active
title: Current state to marketing
purpose: handoff
sensitivity: project
transferStatus: imported
origin:
  projectName: source-app
  storePath: fixtures/cross-repo-demo/source-app/.notch
  repoRoot: fixtures/cross-repo-demo/source-app
  branch: main
recipient:
  targetAgent: claude
  targetPerson: marketing
  targetRepo: fixtures/cross-repo-demo/destination-marketing
summary: Checkout and admin settings changes are ready for launch copy.
includedRecords:
  - id: brief_20260523T171500Z_marketing_context_for_claude
    recordType: brief
    title: Marketing context for Claude
    path: .notch/briefs/20260523T171500Z-marketing-context-for-claude.md
    summary: Scope and exclusions for the marketing handoff.
includedSourceLinks:
  - kind: file
    path: README.md
    label: product overview
  - kind: file
    path: src/features/checkout.ts
    label: checkout behavior
importNotes: Review the packet, then draft only from included facts.
importedFrom: 20260523T172000Z-current-state-to-marketing.md
importedAt: 2026-05-23T17:25:00Z
createdAt: 2026-05-23T17:20:00Z
createdBy:
  actorType: agent
  name: Claude Code
sourceTool:
  name: claude-code
tags: [marketing, demo]
sourceLinks: []
reviewStatus: reviewed
---

## Summary

Checkout and admin settings changes are ready for launch copy.

## Recipient

Claude and the marketing workspace.

## Origin

source-app (fixtures/cross-repo-demo/source-app/.notch)

## Included Context

- Marketing context for Claude

## Source Links

- README.md
- src/features/checkout.ts

## Import Notes

Review the packet, then draft only from included facts.
