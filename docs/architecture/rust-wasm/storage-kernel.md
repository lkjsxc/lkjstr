# Storage Kernel

## Purpose

This file defines Rust ownership for durable browser storage. Status: partial.

## Owner

Implemented now: `lkjstr-storage` owns the executable storage table manifest,
cache ledger resource map, typed operation outcomes, the tab-state key plus
ledger-row contract for workspace snapshots, and Rust record shapes for
protected startup data. `lkjstr-web` owns a narrow real IndexedDB adapter for
workspace startup, workspace rows, settings override rows, protected account
rows, local secrets, relay sets, Tweet drafts, and the first multi-store
transaction helper. Rust tab-state snapshot writes store the `tabStates` row and
matching `cacheLedger` row in one IndexedDB transaction.

Target now: OPFS-backed SQLite WASM in a dedicated worker. The detailed target
lives in [../data/sqlite-opfs/README.md](../data/sqlite-opfs/README.md).

Not implemented yet: SQLite worker bootstrap, executable SQL schema records,
full repository families, request deadlines, cancellation, retention
dispatchers, ledger repair, diagnostics inventory, and most ledger-backed
resource writes.

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
- `Blocked`.
- `Quota`.
- `Corrupt`.
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

Feature code will call repositories, not raw IndexedDB stores. The first Rust
repository boundaries use the manifest `workspaces`, `settings`, and
`tabStates` tables. Ledger-backed writes must store resource rows and ledger
rows atomically where IndexedDB transaction support allows it.

Protected user data is never removed by cache pressure. Recoverable cache data
is removed only through cache-ledger dispatchers.

## Host Adapter

The current host adapter uses `web_sys` IndexedDB directly for the partial
Leptos shell. It remains temporary while SvelteKit product paths still need
Dexie and while Rust/SQLite repositories are incomplete.

The target adapter creates a SQLite worker, sends typed storage requests,
enforces deadlines, maps outcomes, supports cancellation, closes idempotently,
and exposes diagnostics. Each callback is stored in an owner slot and cleared on
settle, cancel, timeout, or close. Late worker responses become typed late
outcomes rather than reaching product logic.
