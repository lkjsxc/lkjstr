# SQLite OPFS Runtime

## Purpose

This file defines how the browser opens and owns the SQLite WASM database.
Status: partial host implementation with product cutover still in progress.

## Runtime Owner

The storage worker owns official SQLite WASM initialization, database open,
schema changes, prepared statement execution, transactions, health diagnostics,
integrity checks, reset, cancellation, and close.

The main thread owns only the storage client registry, request ids,
cancellation, UI status, and recovery when storage cannot open.

`lkjstr-storage` owns SQL text and statement meaning. Product modules and UI
components do not send raw SQL.

## Logical Owner

The browser keeps one logical owner per origin, worker URL, and database name.
The product database name is `/lkjstr/main.sqlite3`. Repository operations borrow
or clone the shared store for that key. They do not create independent workers
and do not close the database after each command.

Open is idempotent for the same database. A repeated open returns the current
owner diagnostics without closing SQLite. Opening a different database requires
an explicit reset, test reset, or controlled shutdown; otherwise the worker
returns a busy outcome.

Worker commands are serialized by one queue per worker. `cancel` records the
target request immediately; every other request runs after the previous request
settles and posts exactly one response.

Schema application is keyed by schema hash and runs once per logical owner.
Later requests for an already applied hash return success without rerunning the
statements.

## Static Assets

The browser build emits the official SQLite WASM package assets under
`/sqlite/`. The product storage client uses the same-origin static worker at
`/sqlite-opfs-worker.js`, which loads the same-origin module and `sqlite3.wasm`
asset.

## VFS Selection

Preferred order:

1. `opfs-sahpool`: normal browser mode because it is worker-only, fast, and does
   not require cross-origin isolation headers. This is the current hosted
   primary mode. SAH pool install is a worker-lifetime single-flight operation,
   and `initialCapacity` is a file-slot count, not bytes; the target slot count
   is 64.
2. `opfs-wl`: allowed after browser support and media rendering are verified.
3. `opfs`: allowed only behind an explicit mode switch when cross-origin
   isolation is safe for the deployment.
4. `:memory:`: explicit temporary mode when persistent storage cannot open and
   the caller allowed transient storage.

The standard `opfs` VFS requires SharedArrayBuffer and therefore COOP/COEP
headers. Do not enable those headers only for storage if they break arbitrary
Nostr media rendering. Normal hosting should rely on `opfs-sahpool` and avoid
app-wide cross-origin isolation unless media rendering has been verified.

## Worker Kind

Preferred ownership is SharedWorker so multiple tabs share one storage owner.
Dedicated Worker is allowed as a fallback only with an owner lock, explicit busy
handling, and visible temporary mode when persistence is blocked and transient
storage is allowed.

The worker reports `workerKind`, `mode`, `vfsName`, `databaseName`, warnings,
and capability flags through storage health.

## Transactions

Use short transactions. Relay event batches commit as one bounded transaction:
validate caps, validate events, upsert events, upsert relay receipts, insert tag
rows, update feed evidence, and return inserted, duplicate, and rejected counts.

Do not enable WAL by default. Browser OPFS concurrency is governed by the VFS,
the serialized worker command queue, and the worker ownership model, not by
multiple UI-owned database handles.

## Failure Mapping

- missing worker support: `open-failed`.
- OPFS API or VFS missing: `opfs-unavailable`.
- OPFS access-handle contention, `NoModificationAllowedError`, locked files, or
  an existing writer: `busy`.
- browser policy, permission denial, or unavailable security feature: `blocked`.
- deadline expiration or caller abort: `cancelled`.
- quota failure: `sql-error` with a quota warning.
- malformed rows: `decode-failed`.
- schema constraint failure: `constraint-failed`.
- unknown failure: `unknown`.

Persistent open failure may fall back to temporary memory only when the caller
allows it, and the UI must show that mode.
