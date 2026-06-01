# Storage Kernel

## Purpose

This file defines Rust ownership for durable browser storage. Status: partial.

## Owner

Implemented now: `lkjstr-storage` owns the executable storage table manifest,
cache ledger resource map, typed operation outcomes, executable SQLite schema
records, protected SQL statement records, schema hash, the tab-state key plus
ledger-row contract for workspace snapshots, and SQLite row codecs for
protected startup data. `lkjstr-web` owns a narrow real IndexedDB adapter for
workspace startup, workspace rows, settings override rows, protected account
rows, local secrets, relay sets, Tweet drafts, and the first multi-store
transaction helper. Rust tab-state snapshot writes store the `tabStates` row and
matching `cacheLedger` row in one IndexedDB transaction.

The SvelteKit host layer now has a temporary SQLite WASM worker/client
bootstrap using the official `@sqlite.org/sqlite-wasm` package. It can open
OPFS or explicit fallback storage, apply schema statements, execute statements,
query rows, run atomic batches, estimate storage, close idempotently, enforce
request deadlines, issue cancellation messages, and report late diagnostics.
This is browser host glue, not product storage ownership.

The Rust/Trunk build now has a static `/sqlite-opfs-worker.js` worker entry.
Trunk copies the pinned official SQLite WASM output to `/sqlite/`, and the
SvelteKit build emits the same assets so the worker path has browser smoke
coverage before product cutover.

`lkjstr-web` now also owns a typed Rust storage-worker adapter. It creates and
terminates a browser `Worker`, sends typed envelopes, enforces request
deadlines, supports explicit cancellation, drops callbacks on close, maps worker
outcomes into the storage outcome contract, and records late response counters.
It also has protected SQLite repository calls for settings, workspaces, tab
states plus ledger, accounts, local secrets, relay sets, and Tweet drafts. These
calls are not wired into product startup yet.

Target now: OPFS-backed SQLite WASM in a dedicated worker. The detailed target
lives in [../data/sqlite-opfs/README.md](../data/sqlite-opfs/README.md).

Not implemented yet: cache and diagnostics repository families, product wiring
to SQLite, route-block repositories, retention dispatchers, ledger repair,
diagnostics inventory, full browser OPFS matrix tests, multi-tab lock handling,
and most cache ledger-backed resource writes.

## Manifest Contract

The current Rust manifest matches
[../data/storage/data-classes/table-manifest.md](../data/storage/data-classes/table-manifest.md).
The SQLite target is described in
[../data/sqlite-opfs/schema.md](../data/sqlite-opfs/schema.md). Rust tests must
prove table names, indexes, retention flags, classes, groups, resource links,
tab-state keys, and ledger rows. Repository checks compare executable records
with Markdown docs as each schema family lands.

Each table declares:

- table name.
- data class.
- inventory group.
- ledger resource.
- owner.
- retention rule.

## Typed Outcomes

Storage operations return a typed outcome:

- `Ok`.
- `Unavailable`.
- `Timeout`.
- `Busy`.
- `Blocked`.
- `Quota`.
- `Corrupt`.
- `Canceled`.
- `LateSettled`.
- `LateRejected`.

UI and Stats paths continue from these states without uncaught runtime errors.

The Rust workspace adapter maps browser IndexedDB availability, blocked opens,
quota failures, corrupt stored rows, and request failures into this outcome
contract. Tab-state startup loading is best-effort: unavailable or corrupt
snapshot rows do not prevent workspace recovery. Browser storage callers outside
the Rust workspace startup path still use the TypeScript operation result until
their repositories are ported.

## Repository Rule

Feature code will call repositories, not raw IndexedDB stores or raw worker SQL.
The first Rust SQLite repository calls cover protected data. Ledger-backed
writes must store resource rows and ledger rows atomically.

Protected user data is never removed by cache pressure. Recoverable cache data
is removed only through cache-ledger dispatchers.

## Host Adapter

The current host adapter uses `web_sys` IndexedDB directly for the partial
Leptos shell. It remains temporary while SvelteKit product paths still need
Dexie and while Rust/SQLite repositories are incomplete.

The temporary TypeScript host adapter creates a SQLite worker, sends typed
storage requests, enforces deadlines, maps outcomes, supports cancellation,
closes idempotently, and exposes diagnostics. Each callback is stored in an
owner slot and cleared on settle, cancel, timeout, or close. Late worker
responses become typed late outcomes rather than reaching product logic.

The Rust adapter exposes the same boundary through `lkjstr-web`. Protected Rust
repository calls now use it, but product paths still need wiring before they can
leave IndexedDB or Dexie.
