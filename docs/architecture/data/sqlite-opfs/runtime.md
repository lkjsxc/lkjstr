# SQLite OPFS Runtime

## Purpose

This file defines how the browser opens and owns the SQLite WASM database.
Status: partial host implementation with product cutover still in progress.

## Runtime Owner

The storage worker owns official SQLite WASM initialization, database open,
schema changes, prepared statement execution, transactions, health diagnostics,
integrity checks, reset, cancellation, and close.

The main thread owns only the storage client, request ids, cancellation, UI
status, and recovery when storage cannot open.

`lkjstr-storage` owns SQL text and statement meaning. Product modules and UI
components do not send raw SQL.

## Static Assets

The browser build emits the official SQLite WASM package assets under
`/sqlite/`. The product storage client uses the same-origin static worker at
`/sqlite-opfs-worker.js`, which loads the same-origin module and `sqlite3.wasm`
asset. The app database name is `/lkjstr/main.sqlite3`.

## VFS Selection

Preferred order:

1. `opfs-sahpool`: normal browser mode because it is worker-only, fast, and does
   not require cross-origin isolation headers. This is the current hosted
   primary mode.
2. `opfs-wl`: allowed after browser support and media rendering are verified.
3. `opfs`: allowed only behind an explicit mode switch when cross-origin
   isolation is safe for the deployment.
4. `:memory:`: explicit temporary mode when persistent storage cannot open.

The standard `opfs` VFS requires SharedArrayBuffer and therefore COOP/COEP
headers. Do not enable those headers only for storage if they break arbitrary
Nostr media rendering. Normal hosting should rely on `opfs-sahpool` and avoid
app-wide cross-origin isolation unless media rendering has been verified.

## Worker Kind

Preferred ownership is SharedWorker so multiple tabs share one storage owner.
Dedicated Worker is allowed as a fallback only with explicit ownership and busy
state handling.

The worker reports `workerKind`, `mode`, `vfsName`, `databaseName`, warnings,
and capability flags through storage health.

## Transactions

Use short transactions. Relay event batches commit as one bounded transaction:
validate caps, validate events, upsert events, upsert relay receipts, insert tag
rows, update feed evidence, and return inserted, duplicate, and rejected counts.

Do not enable WAL by default. Browser OPFS concurrency is governed by the VFS
and the worker ownership model, not by multiple UI-owned database handles.

## Failure Mapping

- missing worker support: `open-failed`.
- OPFS API or VFS missing: `opfs-unavailable`.
- SQLite busy or locked state: `busy`.
- deadline expiration or caller abort: `cancelled`.
- quota failure: `sql-error` with a quota warning.
- malformed rows: `decode-failed`.
- schema constraint failure: `constraint-failed`.
- unknown failure: `unknown`.

Persistent open failure may fall back to temporary memory only when the caller
allows it, and the UI must show that mode.
