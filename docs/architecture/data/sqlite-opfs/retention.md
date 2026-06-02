# SQLite OPFS Retention

## Purpose

This file defines cache retention for SQLite OPFS storage. Status: partial:
ledger schema, resource mapping, row codecs, and ledger-backed write helpers
exist; SQLite compaction, repair, and pressure dispatch are open.

## Data Classes

Protected data:

- accounts.
- local signing secrets.
- settings.
- relay sets.
- workspace layout.
- Tweet drafts.
- active tab snapshots.
- queued or running jobs.
- user relay route blocks.

Recoverable data:

- cached events, tags, and relay provenance.
- notifications rebuilt from event cache and relay reads.
- feed cursors, coverage, and scan hints.
- relay information and diagnostics.
- route evidence and relay suggestions.
- finished jobs.
- stale absent tab snapshots.
- app log rows outside the bounded diagnostic window.

## Cache Ledger

`cache_ledger` is the only eviction queue. Every compactable resource has a
resource id, resource kind, owning table, byte count, protection flag, score,
owner key, creation time, and update time. Implemented repository helpers write
ledger rows atomically with events, feed cache, notifications, diagnostics,
jobs, route evidence, and tab snapshots.

Protected rows may appear in the ledger for inventory, but compaction skips
them. Missing or incomplete ledger evidence stops compaction for that resource
family instead of guessing.

## Dynamic Protection

Runtime-visible feed rows, open references, active tabs, active jobs, and
current account data can protect recoverable rows while their owners are alive.
Dynamic protection is bounded and owner-scoped; it does not turn recoverable
cache into permanent protected data.

## Compaction Order

1. Refresh storage estimates and ledger totals.
2. Build dynamic protection for active owners.
3. Select unprotected ledger rows by score and oldest update time.
4. Delete through table-specific dispatchers.
5. Remove matching ledger rows in the same batch.
6. Stop when usage is below target or when a typed stop reason explains why it
   cannot continue.

Compaction never treats dense, incomplete, compacted, failed, unresolved, or
missing feed coverage as proof of absence.

## Quota Behavior

Quota errors return `Quota` and are visible in Stats. If compaction cannot free
space, Stats reports protected data, recoverable data, incomplete inventory,
unknown browser overhead, or unavailable storage APIs. It must not report fake
success.
