# Deletion

## Purpose

Deletion dispatchers remove recoverable resources and their ledger rows without
touching protected data.

## Dispatcher Rules

- Delete by `resourceKind`.
- Delete the target resource and ledger row together where possible.
- Event deletion also deletes relay receipts and searchable tag rows.
- Notification deletion does not delete events.
- Feed cursor, coverage, and scan hint deletion does not delete events.
- Diagnostics deletion does not delete relay sets or route blocks.
- Finished job deletion does not delete active jobs.
- Stale tab-state deletion does not delete active workspace snapshots.

## Event Coverage Rule

Event deletion invalidates feed coverage that could depend on deleted events.
When precise matching is unavailable, delete coverage conservatively.

## Target Rule

If a selected ledger row's target state is unavailable, do not delete it. Report
inventory or target unavailability and continue with safer candidates.
