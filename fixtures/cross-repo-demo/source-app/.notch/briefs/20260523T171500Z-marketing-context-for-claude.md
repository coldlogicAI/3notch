---
id: brief_20260523T171500Z_marketing_context_for_claude
schemaVersion: "1.0.0"
recordType: brief
status: active
title: Marketing context for Claude
targetAgent: claude
goal: Draft launch copy grounded in shipped repo state.
scope:
  topics:
    - checkout
    - admin settings
  files:
    - README.md
    - src/features/checkout.ts
exclusions:
  - Do not mention future roadmap items.
relevantFiles:
  - kind: file
    path: README.md
designBasis: The source app packet provides the reviewable basis for copy.
priorReasoningSummary: Marketing needs facts from the implementation repo without raw chat history.
constraints:
  - Keep claims source-linked.
recommendedNextSteps:
  - Read the imported packet before drafting.
createdAt: 2026-05-23T17:15:00Z
createdBy:
  actorType: human
  name: Fixture Author
sourceTool:
  name: notch-cli
tags: [marketing, demo]
sourceLinks: []
reviewStatus: reviewed
---

## Goal For claude

Draft launch copy grounded in shipped repo state.

## Relevant Background

- Checkout flow copy now reflects the new review step.
- Admin settings were simplified for team managers.

## Prior Reasoning Summary

Marketing needs facts from the implementation repo without raw chat history.

## Design Basis

The source app packet provides the reviewable basis for copy.

## Relevant Files And Sources

- README.md
- src/features/checkout.ts

## Known Pitfalls

- Do not mention future roadmap items.

## Recommended Next Steps

- Read the imported packet before drafting.
