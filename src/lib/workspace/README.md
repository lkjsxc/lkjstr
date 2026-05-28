# Workspace

## Purpose

This directory contains workspace layout, tab, pane, persistence, and recovery
logic.

## Table of Contents

- Layout tree, pane commands, tab runtime, persistence, resize, and recovery
  helpers.
- Resize math is shared by pointer and keyboard handles.
- `tab-snapshot-coordinator.ts` owns tab-retention state by
  `workspaceId + tabId`; pane id is placement metadata only.
- Snapshot helpers keep warm LRU, durable `tabStates`, one-shot restore tokens,
  and cleanup aligned with the docs contracts.
