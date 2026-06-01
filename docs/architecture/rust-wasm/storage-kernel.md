# Storage Kernel

## Purpose

This file defines Rust ownership for durable browser storage. Status: partial.

## Owner

Implemented now: `lkjstr-storage` owns the executable storage table manifest,
cache ledger resource map, typed operation outcomes, the tab-state key plus
ledger-row contract for workspace snapshots, and the Rust workspace record
shape. `lkjstr-web` owns a narrow real IndexedDB adapter for workspace startup,
workspace rows, settings override rows, protected account rows, local secrets,
relay sets, Tweet drafts, and the first multi-store transaction helper.
Rust tab-state snapshot writes now use that helper to store the `tabStates` row
and matching `cacheLedger` row in one IndexedDB transaction.
Workspace startup loads stored tab snapshots for the stored workspace and lets
`lkjstr-app` filter them against the recovered workspace shape.

Not implemented yet: full repository families, single-request deadline guards,
retention dispatchers, ledger repair, diagnostics inventory, and most
ledger-backed resource writes.

## Manifest Contract

The Rust manifest matches
[../data/storage/data-classes/table-manifest.md](../data/storage/data-classes/table-manifest.md).
Rust tests prove table names, retention flags, classes, groups, resource links,
tab-state keys, and tab-state ledger rows. Repository checks will compare
executable records with the Markdown table when the xtask manifest-doc
comparison is expanded.

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

## IndexedDB Adapter

The first host adapter uses `web_sys` IndexedDB directly. It opens the `lkjstr`
database at the documented schema step, creates manifest stores and indexes on
upgrade, stores protected rows as structured browser objects, and reads them
back into Rust workspace and settings record values.

Each request callback is stored in an owner slot and cleared when the request
settles. The multi-store transaction helper stores completion, error, abort, and
timer callbacks in owned slots, clears them when the transaction settles or
times out, and maps timeout to the typed outcome contract. Single-request
deadline timers, late-settlement counters, and most ledger-backed transactions
remain open.
