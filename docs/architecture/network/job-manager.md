# Job Manager

## Purpose

Job manager records long-running in-app work so runtime state survives tab
changes and can be inspected by diagnostics.

## Contract

- Jobs are persisted in IndexedDB and mirrored in memory for tests.
- Jobs form a tree with optional `rootId`, `parentId`, path, label, progress,
  output, and cancellation metadata.
- Supported jobs are relay subscription, paged backfill, notification sync,
  publish, and cache maintenance.
- A job starts as queued, may become running, and finishes as completed, failed,
  or canceled.
- Job listeners receive state snapshots after enqueue, cancellation, completion,
  and failure.
- Root, child, progress, `cancelTree`, `listTree`, and stale-startup helpers
  keep diagnostics grouped without adding separate New Tab choices.
- Runtime code records errors on the job instead of hiding them in component
  state only.
