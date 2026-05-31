# Deletion

## Purpose

Deletion dispatchers remove recoverable resources and their ledger rows without
touching protected data.

## Dispatcher Rules

- Delete by `resourceKind`.
- Delete the target resource and ledger row together where possible.
- Event deletion also deletes relay receipts and searchable tag rows.
- Event deletion invalidates or deletes feed cursors, feed coverage, scan
  hints, and other page evidence that could depend on deleted events.
- Notification deletion does not delete events.
- Feed cursor, coverage, and scan hint deletion does not delete events.
- Diagnostics deletion can remove relay information, relay suggestions, author
  route evidence, and relay summaries. It must not delete relay sets, account
  relay lists, or route blocks.
- Finished job deletion does not delete active jobs.
- Stale tab-state deletion does not delete active workspace snapshots.
- Deleting any ledger-managed resource must not leave orphan ledger rows.

## Old Storage Cleanup Rule

Manual repair may delete old stores or databases only when a cleanup
classifier marks them obsolete and recoverable. Unknown stores and unknown
databases are visible in Stats but are not auto-deleted. Protected stores,
local signing secrets, settings, relay sets, workspace state, drafts, safety
configuration, and active runtime state are never deleted by cleanup.

## Event Coverage Rule

Event deletion invalidates feed coverage that could depend on deleted events.
When precise matching is unavailable, delete coverage conservatively.

## Target Rule

If a selected ledger row's target state is unavailable, do not delete it. Report
inventory or target unavailability and continue with safer candidates.
