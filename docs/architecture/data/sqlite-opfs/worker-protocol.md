# SQLite Worker Protocol

## Purpose

This file defines the typed protocol between product repositories and the
worker-owned SQLite storage kernel.

## Envelope

Every request carries:

- `requestId`: caller-generated stable id.
- `command`: one discriminated storage command.

Every response is either:

- `{ requestId, ok: true, value }`.
- `{ requestId, ok: false, error }`.

Errors carry `kind`, `message`, optional cause fields, and `recoverable`.

## Command Families

Product repositories use typed commands, not raw SQL:

- open, close, health, integrity check, compact, reset.
- settings load, save, delete, and replace.
- workspace and tab-state load, save, delete, and cleanup.
- accounts, local secrets, relay sets, and Tweet drafts.
- event batch ingestion, event lookup, timelines, profile events, threads,
  action-state evidence, and local search.
- notifications derive, query, and mark read.
- relay information, diagnostics, suggestions, author routes, and route blocks.
- jobs and app log records.
- cache ledger, inventory, retention, repair, import, and export.

The lower host adapter may carry storage-crate statement ids and bound
parameters, but product UI code must never construct SQL text.

## Health Command

`getStorageHealth` returns:

- mode: `persistent-opfs` or `temporary-memory`.
- VFS name and worker kind.
- SQLite library text and database name.
- applied schema changes.
- page count, page size, freelist count.
- event, relay receipt, and tag row counts.
- last integrity check time.
- warnings and capability flags.

Stats and Cache tools read this command directly through a repository.

## Error Kinds

- `open-failed`.
- `opfs-unavailable`.
- `sql-error`.
- `constraint-failed`.
- `decode-failed`.
- `cancelled`.
- `busy`.
- `temporary-mode`.
- `unknown`.

`busy`, `cancelled`, and temporary-mode warnings are recoverable when the caller
still has a bounded UI fallback. Protected data failures remain visible.

## Cancellation

Cancellation is explicit. The app cancels storage work when a tab closes, a feed
runtime releases demand, a publish job is abandoned, or a deadline expires.

The client drops the callback owner on cancel. Late worker responses update
storage diagnostics but are not delivered to product logic.

## Relay Ingestion Batch

A relay event batch commits in one transaction:

1. Enforce app-owned byte and structure caps.
2. Validate Nostr event shape and id.
3. Insert or ignore the canonical event row.
4. Upsert relay provenance with received and latest-seen times.
5. Insert ordered tag rows when missing.
6. Derive notifications for unlocked account pubkeys.
7. Update feed cursor or coverage evidence when the caller supplied it.
8. Return inserted, duplicate, rejected, and notification counts.

No fake events or protocol placeholders may be inserted.
