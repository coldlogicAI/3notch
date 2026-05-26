---
id: packet_v2_source
schemaVersion: "0.3.0"
recordType: packet
status: active
title: V2 source packet
purpose: handoff
sensitivity: project
transferStatus: outbox
origin:
  projectName: v2-back-compat
  storePath: /tmp/v2-back-compat/.notch
  repoRoot: /tmp/v2-back-compat
recipient:
  targetAgent: codex
summary: V2 source packet summary.
includedRecords:
  - id: brief_v2_fixture
    recordType: brief
    title: V2 fixture brief
    path: .notch/briefs/20260524T120100Z-v2-brief.md
includedSourceLinks:
  - kind: file
    path: src/index.ts
createdAt: 2026-05-24T12:02:00Z
createdBy:
  actorType: agent
  name: Codex
sourceTool:
  name: notch-cli
tags: [v2]
sourceLinks: []
reviewStatus: unreviewed
---

## Summary

V2 source packet summary.

## Recipient

codex

## Origin

v2-back-compat (/tmp/v2-back-compat/.notch)

## Included Context

- V2 fixture brief.

## Source Links

- src/index.ts

## Import Notes

Review before use.
