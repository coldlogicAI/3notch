---
id: brief_schema_slice
schemaVersion: "1.0.0"
recordType: brief
status: active
title: Schema slice
targetAgent: codex
goal: Implement and verify Wave 2 schemas.
scope:
  topics:
    - schemas
  files:
    - src/schemas
exclusions: []
relevantFiles:
  - kind: file
    path: docs/example.md
designBasis: The technical spec defines V1 record contracts.
priorReasoningSummary: Keep schema work independent from CLI transport.
constraints:
  - Do not add deferred commands.
recommendedNextSteps:
  - Implement parser tests.
createdAt: 2026-05-23T18:10:00Z
createdBy:
  actorType: human
  name: Test User
sourceTool:
  name: notch-cli
tags: [schemas]
sourceLinks: []
reviewStatus: reviewed
---

## Goal For Codex

Implement and verify Wave 2 schemas.

## Relevant Background

- V1 stores Markdown with YAML frontmatter.

## Prior Reasoning Summary

Keep schema work independent from CLI transport.

## Design Basis

The technical spec defines V1 record contracts.

## Relevant Files And Sources

- `docs/example.md`

## Known Pitfalls

- Do not add deferred commands.

## Recommended Next Steps

- Implement parser tests.
