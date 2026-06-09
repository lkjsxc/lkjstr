# Repair

## Purpose

Repair restores ledger consistency for recoverable cache resources without
deleting protected records or trusting unavailable stores.

## SQLite Algorithm

Repair is a SQLite worker command. Product UI calls the repository command and
never scans stores directly.

1. Start a repair run and record start time in memory.
2. For each ledger manifest resource, scan the owning SQLite table in chunks by
   its deterministic primary-key cursor.
3. Build the ledger row from the resource codec and owned child-row byte
   estimates.
4. Upsert a missing ledger row in the same worker transaction chunk.
5. Update stale byte estimates only when the existing row is not protected.
6. Scan `cache_ledger` in chunks by `id`.
7. Check each ledger target with the manifest-owned table and primary key.
8. Delete an orphan ledger row only when the target state is definitely
   `missing`.
9. Skip deletion when the target state is `unavailable`.
10. Delete unowned cache rows only when the manifest classifier proves the row is
    recoverable and not protected.
11. Write repair metadata to `cache_meta`.

## Target State

| State | Meaning | Deletion allowed |
| --- | --- | --- |
| `present` | The owning SQLite table was read and the primary key exists. | no |
| `missing` | The owning SQLite table was read and the primary key does not exist. | yes, for unprotected ledger rows |
| `unavailable` | The table, row codec, query, or chunk budget was unavailable. | no |

## Physical Probes

`repair.probe-targets` is the physical target command. `lkjstr-storage`
chooses the resource-kind and table route, and `lkjstr-web` executes only the
approved `*.repair_probe` statement id for that route. Product code supplies
typed targets only; it never supplies SQL, table names for ad hoc probing, or
raw predicates.

Probe output feeds `repair.scan-ledger`. Unknown resource kinds, table/resource
kind mismatches, protected rows, and unprobeable composite owners remain
reported as unavailable or unknown instead of safe. A missing target is only a
fact for an approved statement that ran successfully.

## Chunking

Every repair scan uses:

```text
scan(table, after_primary_key, limit) -> rows, next_primary_key
```

The cursor is the table primary key, or an explicitly documented deterministic
index when a table has a composite primary key. Chunk limits are bounded by the
worker command input. A chunk that exhausts its budget reports partial metadata
instead of deleting anything it did not prove missing.

## Metadata And Stats

Repair metadata records scanned resource rows, scanned ledger rows, chunks
processed, missing rows inserted, stale rows updated, protected rows skipped,
orphan rows deleted, unowned rows deleted, unavailable targets skipped, start
time, finish time, elapsed time, and partial reason. Stats projects the latest
metadata, plus `orphanLedgerRows` and `missingLedgerRows`, from SQLite.

## Rule

Full-table `toArray()` repair is allowed only in tests. Product repair must use
SQLite chunk cursors and typed repositories.

Repair is conservative. It never deletes protected account data, signing
secrets, settings, relay sets, workspace state, drafts, active jobs, active tab
snapshots, route blocks, or safety configuration.
