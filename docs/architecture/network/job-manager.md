# Job Manager

## Purpose

Job manager records supported in-app work so runtime state survives tab changes
and can be inspected by lkjstr Log.

## Contract

- Jobs are persisted in IndexedDB and mirrored in memory for tests.
- Jobs form a tree with optional `rootId`, `parentId`, path, label, progress,
  output, and cancellation metadata.
- Supported job kinds are relay subscription, paged backfill, notification
  sync, publish, and cache maintenance.
- A job starts as queued, may become running, and finishes as completed, failed,
  or canceled.
- Job listeners receive hydrated memory snapshots and updates after enqueue,
  cancellation, completion, and failure.
- Root, child, progress, `cancelTree`, `listTree`, and stale-startup helpers
  keep diagnostics grouped without adding separate New Tab choices.
- Startup marks queued or running jobs stale once per workspace load.
- `cancelTree` cancels only non-terminal jobs; completed, failed, and already
  canceled descendants keep their terminal status and metadata.
- lkjstr Log is the control surface for non-terminal root-job cancellation.
- Runtime instrumentation is limited to code paths that explicitly enqueue or
  update jobs.
