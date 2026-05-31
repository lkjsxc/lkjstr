# Dynamic Protection

## Purpose

Dynamic protection keeps runtime-critical cache rows safe without making all
recoverable cache permanently protected.

## Protection Sources

- runtime pins
- open tab snapshots
- active workspace tabs
- active jobs
- latest kind `0` metadata per pubkey
- latest kind `3` follow list for local accounts
- recent unread notifications
- latest notification window per account
- notification root, target, and source events
- explicit protected ledger rows

## Snapshot Rule

Compaction builds a `ProtectionSnapshot` before selecting rows. Protection
reads should be indexed, bounded, and chunked. Each scan has a row budget or
deadline.

If protection is partial because a scan times out or a store is unavailable,
compaction must be conservative. It deletes fewer rows rather than risking a
protected record.

## Verification

Tests cover active tab snapshots, unread notifications, notification source
events, latest metadata, latest follow lists, and partial protection.
