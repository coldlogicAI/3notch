---
id: packet_20260523T173000Z_user_workflow_seed
schemaVersion: "1.0.0"
recordType: packet
status: active
title: User workflow seed
purpose: seed
sensitivity: private
transferStatus: imported
origin:
  projectName: old-project
  storePath: fixtures/context-seed-demo/old-project/.notch
  repoRoot: fixtures/context-seed-demo/old-project
recipient:
  targetRepo: fixtures/context-seed-demo/new-project
summary: Reviewed preferences and workflow conventions for a new repo.
privateContextSummary: Prefer concise progress logs, source-linked packets, and explicit exclusions.
includedRecords: []
includedSourceLinks:
  - kind: repo
    repoName: old-project
    repoRoot: fixtures/context-seed-demo/old-project
    label: reviewed prior work
importNotes: Keep this record private and review before applying it.
importedFrom: 20260523T173000Z-user-workflow-seed-from-old-project.md
importedAt: 2026-05-23T17:30:00Z
createdAt: 2026-05-23T17:30:00Z
createdBy:
  actorType: human
  name: Fixture Author
sourceTool:
  name: notch-cli
tags: [workflow, demo]
sourceLinks: []
reviewStatus: reviewed
---

## Summary

Reviewed preferences and workflow conventions for a new repo.

## Recipient

Private seed packet for new-project.

## Origin

old-project (fixtures/context-seed-demo/old-project/.notch)

## Included Context

- Reviewed workflow preferences.

## Source Links

- old-project reviewed prior work.

## Import Notes

Keep this record private and review before applying it.

## User Preferences

- Prefer concise progress logs.
- Prefer source-linked packets for cross-boundary work.

## Workflow Conventions

- Update implementation logs after coherent slices.
- Review imported packets before acting on them.

## Lessons From Prior Work

- Keep prompt detail in docs when a handoff prompt must stay compact.

## What Not To Carry Forward

- Hidden chat assumptions.
- Tool-specific implementation habits that do not match this repo.
