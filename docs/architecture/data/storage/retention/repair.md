# Repair

## Purpose

Repair restores ledger consistency for recoverable cache resources without
deleting protected records or trusting unavailable stores.

## Algorithm

1. Start a repair run and record start time.
2. For each ledger manifest resource, scan the owning table in chunks.
3. Upsert missing ledger rows.
4. Update stale byte estimates when the existing row is not protected.
5. Scan ledger rows in chunks.
6. Delete orphan ledger rows only when the target is definitely missing.
7. Skip orphan deletion when target state is unavailable.
8. Delete unowned cache rows only when a classifier proves they are
   recoverable and not protected.
9. Delete obsolete legacy stores or databases only when the cleanup allowlist
   classifies them as recoverable.
10. Write repair metadata.

## Metadata

Repair metadata records rows scanned, chunks processed, missing rows inserted,
stale rows updated, orphan rows deleted, unowned rows deleted, legacy stores or
databases deleted, unavailable targets skipped, and elapsed time.

## Rule

Full-table `toArray()` repair is allowed only for tests or bounded stores. Large
or unbounded repair paths must chunk by primary key or another deterministic
index.

Repair is conservative. It never deletes protected account data, signing
secrets, settings, relay sets, workspace state, drafts, active jobs, active tab
snapshots, route blocks, or safety configuration.
