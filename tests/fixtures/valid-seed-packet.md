---
id: packet_seed_schema_slice
schemaVersion: "1.0.0"
recordType: packet
status: active
title: Private workflow seed
purpose: seed
sensitivity: private
transferStatus: outbox
origin:
  projectName: old-project
  storePath: /tmp/old-project/.notch
recipient: {}
summary: Reviewed workflow preferences for a new repo.
privateContextSummary: User prefers source-linked implementation notes.
includedRecords: []
includedSourceLinks: []
createdAt: 2026-05-23T18:30:00Z
createdBy:
  actorType: human
  name: Test User
sourceTool:
  name: notch-cli
tags: [workflow]
sourceLinks: []
reviewStatus: reviewed
---

## Summary

Reviewed workflow preferences for a new repo.

## Recipient

New local project.

## Origin

old-project.

## Included Context

- Reviewed workflow preferences.

## Source Links

- None.

## Import Notes

Keep private.

## User Preferences

- Prefer source-linked implementation notes.

## Workflow Conventions

- Verify before commit.

## Lessons From Prior Work

- Keep packet scope explicit.

## What Not To Carry Forward

- Tool-specific hidden chat assumptions.
