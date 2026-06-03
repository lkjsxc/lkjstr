# Stats Tab

## Purpose

Stats shows current-session network and cache counters.

## Table of Contents

- [Contract](#contract)

## Contract

- Stats opens from New Tab as `network-stats`.
- It reads relay snapshots, optimizer snapshots, cache status, SQLite worker
  health, job health, and runtime memory counters.
- It labels active subscriptions by redacted purpose instead of exposing opaque
  ids as the primary row text.
- `subscription-rows.ts` maps relay snapshots into Stats table rows.
- `StorageHealthPanel.svelte` renders the SQLite mode, VFS, page counts, and
  temporary-storage warning.
- `OptimizerPanel.svelte` renders real in-memory relay score and scan hint rows.
- It never creates relay subscriptions.
- Manual refresh is always available.
- Optional auto-refresh polls every two seconds while enabled.
