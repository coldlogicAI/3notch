---
id: packet_schema_slice
schemaVersion: "1.0.0"
recordType: packet
status: active
title: Schema slice packet
purpose: handoff
sensitivity: project
transferStatus: outbox
origin:
  projectName: source-app
  storePath: /tmp/source-app/.notch
  repoRoot: /tmp/source-app
  branch: main
  commit: abc123
recipient:
  targetAgent: codex
  targetRepo: destination-app
summary: Carries schema implementation context into another repo.
includedRecords:
  - id: brief_schema_slice
    recordType: brief
    title: Schema slice
    path: .notch/briefs/schema.md
    summary: Brief summary.
includedSourceLinks:
  - kind: file
    path: docs/example.md
createdAt: 2026-05-23T18:20:00Z
createdBy:
  actorType: agent
  name: Codex
sourceTool:
  name: notch-mcp
  client: codex
tags: [schemas]
sourceLinks: []
reviewStatus: unreviewed
---

## Summary

Carries schema implementation context into another repo.

## Recipient

Codex in destination-app.

## Origin

source-app.

## Included Context

- Schema slice brief.

## Source Links

- `docs/example.md`

## Import Notes

Review before implementation.
