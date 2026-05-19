# Job Manager

## Purpose

Job manager records long-running in-app work so runtime state survives tab
changes and can be inspected by diagnostics.

## Contract

- Jobs are persisted in IndexedDB and mirrored in memory for tests.
- Supported jobs are relay subscription, paged backfill, notification sync,
  publish, and cache maintenance.
- A job starts as queued, may become running, and finishes as completed, failed,
  or canceled.
- Job listeners receive state snapshots after enqueue, cancellation, completion,
  and failure.
- Runtime code records errors on the job instead of hiding them in component
  state only.
