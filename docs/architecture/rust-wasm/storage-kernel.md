# Storage Kernel

## Purpose

This file defines Rust ownership for durable browser storage. Status: partial.

## Owner

Implemented now: `lkjstr-storage` owns the executable storage table manifest,
cache ledger resource map, typed operation outcomes, executable SQLite schema
records, protected, event-cache, and diagnostics SQL statement records, schema
hash, the tab-state key plus ledger-row contract for workspace snapshots,
active-account selector rows, storage pressure snapshot rows, and SQLite row
codecs for protected startup data, events, tags, relay provenance,
notifications, feed cursors, feed coverage, and scan hints. `lkjstr-web` owns a
narrow real IndexedDB adapter for host-boundary tests that still need IndexedDB
and a typed SQLite worker adapter for product storage calls.

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
states plus ledger, accounts, local secrets, relay sets, and Tweet drafts. Rust
startup, workspace persistence, Accounts, Relay Settings, Upload Settings,
Tweet drafts, Stats inventory, and Stats SQLite health now use those SQLite
worker calls. Core event-cache repository calls cover atomic event/tag/relay
writes, event lookups, notification owner reads and marks, feed cursor reads,
feed coverage reads, fresh scan-hint reads, relay diagnostic summaries, relay
information, relay suggestions, author routes, route blocks, jobs, app log
rows, active-account selectors, and pressure snapshots. Feed runtimes and full
diagnostics still need product wiring.

Target now: OPFS-backed SQLite WASM in a dedicated worker. The detailed target
lives in [../data/sqlite-opfs/README.md](../data/sqlite-opfs/README.md).

Not complete yet: feed runtime SQLite wiring, retention product consumption,
repair product consumption, pressure and Stats UI proof for every unavailable
state, Search app planning and NIP-50 merge, full browser OPFS matrix tests,
and multi-tab lock handling.

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

The Rust SQLite worker adapter maps browser worker availability, owner-lock
denial, blocked opens, quota failures, corrupt stored rows, timeouts,
cancellations, and late responses into this outcome contract. Stats maps SQLite
health failures through the same contract, so persistent OPFS, owner busy,
temporary memory, unavailable, timeout, blocked, corrupt, and canceled states
are visible. Tab-state startup loading is best-effort: unavailable or corrupt
snapshot rows do not prevent workspace recovery. Browser storage callers outside
Rust product wiring still use the TypeScript operation result until their
repositories are ported.

## Repository Rule

Feature code will call repositories, not raw IndexedDB stores or raw worker SQL.
The first Rust SQLite repository calls cover protected data, core event-cache
data, and core diagnostics data. Ledger-backed writes must store resource rows
and ledger rows atomically.

Protected user data is never removed by cache pressure. Recoverable cache data
is removed only through cache-ledger dispatchers.

## Host Adapter

The Rust host adapter still includes narrow `web_sys` IndexedDB support for
host-boundary tests. Product storage uses the SQLite worker path.

The temporary TypeScript host adapter creates a SQLite worker, sends typed
storage requests, enforces deadlines, maps outcomes, supports cancellation,
closes idempotently, and exposes diagnostics. Each callback is stored in an
owner slot and cleared on settle, cancel, timeout, or close. Late worker
responses become typed late outcomes rather than reaching product logic.

The Rust adapter exposes the same boundary through `lkjstr-web`. Product Rust
storage calls borrow the JavaScript app broker for `(origin, workerUrl,
databaseName)` through JS reflection, not wasm-bindgen `inline_js`; owner denial
maps to busy or unavailable storage outcomes in the broker before any persistent
worker is constructed. Protected, core event-cache, and diagnostics Rust
repository calls now use it. Remaining Rust work is parity wiring, not an old
browser database dependency.
