# Deletion

## Purpose

Deletion dispatchers remove recoverable resources and their ledger rows without
touching protected data.

## Dispatcher Rules

- Delete by `resourceKind`.
- Delete the target resource and ledger row together where possible.
- Event deletion also deletes relay receipts and searchable tag rows for the
  selected event rows.
- Event compaction must not globally delete feed cursors, feed coverage, scan
  hints, or route evidence.
- Notification deletion does not delete events.
- Feed cursor, coverage, scan hint, and LOD deletion does not delete events.
- Diagnostics deletion can remove relay information, relay suggestions, author
  route evidence, and relay summaries. It must not delete relay sets, account
  relay lists, or route blocks.
- Finished job deletion does not delete active jobs.
- Stale tab-state deletion does not delete active workspace snapshots.
- Deleting any ledger-managed resource must not leave orphan ledger rows.

## Interval Degradation Rule

When ordinary event compaction removes full event payloads, retention degrades
only the affected intervals:

1. Keep shell or block summaries when they still have scroll or recovery value.
2. Preserve recovery recipes for semantic feed key, route fingerprint, filter
   shape, interval, and eligible relay routes.
3. Preserve scan-density models and route evidence unless they are independently
   stale and low value.
4. Delete coverage only for intervals that can no longer be proven because all
   supporting materialization was removed.
5. Record the compaction reason and retained recovery path in retention traces.

Compacted branches never imply that no events exist.

## Old Storage Cleanup Rule

Manual repair may delete old stores or databases only when a cleanup classifier
marks them obsolete and recoverable. Unknown stores and unknown databases are
visible in Stats but are not auto-deleted. Protected stores, local signing
secrets, settings, relay sets, workspace state, drafts, safety configuration,
and active runtime state are never deleted by cleanup.

## Event Coverage Rule

Event deletion invalidates only feed coverage that could depend on the deleted
materialization. When precise interval matching is unavailable, delete coverage
conservatively for the affected semantic key and interval, not globally.

## Target Rule

If a selected ledger row's target state is unavailable, do not delete it. Report
inventory or target unavailability and continue with safer candidates.
