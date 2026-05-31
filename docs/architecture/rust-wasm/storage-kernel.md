# Storage Kernel

## Purpose

This file defines Rust ownership for durable browser storage. Status: partial.

## Owner

Implemented now: `lkjstr-storage` owns the executable storage table manifest,
cache ledger resource map, typed operation outcomes, the tab-state key plus
ledger-row contract for workspace snapshots, and the Rust workspace record
shape. `lkjstr-web` owns a narrow real IndexedDB adapter for workspace startup,
workspace rows, and settings override rows.

Not implemented yet: full repository families, deadline guards, retention
dispatchers, ledger repair, diagnostics inventory, and transaction-backed
resource plus ledger writes.

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
contract. Browser storage callers outside the Rust workspace startup path still
use the TypeScript operation result until their repositories are ported.

## Repository Rule

Feature code will call repositories, not raw IndexedDB stores. The first Rust
repository boundaries use the manifest `workspaces` and `settings` tables.
Ledger-backed writes must store resource rows and ledger rows atomically where
IndexedDB transaction support allows it.

Protected user data is never removed by cache pressure. Recoverable cache data
is removed only through cache-ledger dispatchers.

## IndexedDB Adapter

The first host adapter uses `web_sys` IndexedDB directly. It opens the `lkjstr`
database at the documented schema step, creates manifest stores and indexes on
upgrade, stores protected rows as structured browser objects, and reads them
back into Rust workspace and settings record values.

Each request callback is stored in an owner slot and cleared when the request
settles. The current adapter does not yet own deadline timers, late-settlement
counters, or multi-store transactions.
