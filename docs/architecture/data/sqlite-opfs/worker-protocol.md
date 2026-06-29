# SQLite Worker Protocol

## Purpose

This file defines the typed protocol between product repositories and the
worker-owned SQLite storage kernel.

## Envelope

Every request carries:

- `requestId`: caller-generated stable id.
- `deadlineMs`: caller deadline in milliseconds.
- `op`: one discriminated storage operation.

Every response carries:

- `requestId`: the matching request id.
- `outcome`: `ok`, `unavailable`, `timeout`, `busy`, `blocked`, `quota`,
  `corrupt`, `canceled`, `late-settled`, or `late-rejected`.
- `rows`: result rows for query and inventory operations.
- `rowsAffected`: affected row count for write operations.
- `diagnostics`: storage mode, VFS, health, byte estimates, warnings, or a
  bounded error message.

The lower host adapter may carry storage-crate statement ids and bound
parameters, but product UI code must never construct SQL text.

## Host Operations

The worker protocol currently carries these host operations:

- `open` with `databaseName`, preferred VFS, transient-memory permission, and
  worker-kind hints.
- `apply-schema` with `schemaHash` and ordered SQL statements.
- `execute` with statement text from storage-owned metadata and bound params.
- `query` with statement text from storage-owned metadata, params, and row
  limit.
- `batch` with ordered bounded SQL steps and read/write mode.
- `get-storage-health`.
- `read-physical-inventory`.
- `estimate-storage`.
- `cancel` with `targetRequestId`.
- `close` for explicit reset, tests, and controlled shutdown only.

Repository command families such as settings, accounts, relay sets, feed cache,
notifications, jobs, app log, retention, and repair are typed above this host
envelope. They map to storage-owned statement records or batch records before
reaching the worker.

## Required Storage Tool Commands

| Command | Input | Output | Contract |
| --- | --- | --- | --- |
| `repairCacheLedger` | `nowMs`, `chunkLimit`, `deleteLimit`, `includeUnownedCleanup` | repair progress metadata | Chunks resource and ledger scans; deletes only definitely missing unprotected ledger rows. |
| `readCacheLedgerHealth` | optional `chunkLimit` | orphan and missing ledger counts plus unavailable count | Reports partial or unavailable evidence explicitly. |
| `readPhysicalInventory` | scan limits and deadline | table counts, ledger bytes, storage mode, old-store rows | Reads SQLite catalog and ledger summaries; old IndexedDB rows are diagnostic only. |
| `readCacheToolSummary` | none | cache status fields needed by Stats and cache actions | Combines health, latest repair metadata, pressure, and inventory status. |
| `readActiveAccountSelector` | none | selected account id plus signer availability states | Reads the protected selector row; missing rows are explicit and do not expose secrets. |
| `writeActiveAccountSelector` | selected account id plus signer availability states | stored selector metadata | Writes only public account id, pubkey, signer kind, read-only state, local signer state, NIP-07 availability, and time. |
| `readStoragePressureSnapshot` | none | latest pressure bytes and stop reason | Reads protected, prunable, unknown, residual overhead, pruned counts, and exact stop reason. |
| `writeStoragePressureSnapshot` | pressure bytes and stop reason | stored snapshot metadata | Writes the latest pressure snapshot into metadata without deleting rows. |
| `appendAppLog` | redacted log row | stored row id and retention result | Stores no local secrets, raw relay payloads, filters, tab ids, request ids, subscription ids, or owner handles. |
| `listAppLog` | `limit`, optional `beforeMs` | newest redacted rows | Returns durable rows in reverse chronological order. |
| `clearRecoverableAppLog` | optional age or count policy | deleted count | Deletes only recoverable diagnostic rows. |

## Open And Schema

`open` is idempotent for the already opened database. It returns current
diagnostics without closing SQLite. An open request for a different database
returns `busy` unless a reset or test owner has closed the current database.

`apply-schema` is idempotent per schema hash. Later calls with an applied hash
return `ok` without rerunning statements.

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
- `blocked`.
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
