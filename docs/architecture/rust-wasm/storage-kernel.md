# Storage Kernel

## Purpose

This file defines Rust ownership for durable browser storage. Status: partial.

## Owner

Implemented now: `lkjstr-storage` owns the executable storage table manifest,
cache ledger resource map, typed operation outcomes, and the tab-state key plus
ledger-row contract for workspace snapshots.

Not implemented yet: repositories, retention dispatchers, ledger repair,
diagnostics inventory, and the IndexedDB host adapter. `lkjstr-web` will own the
IndexedDB adapter when that browser effect boundary is ported.

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

The current Rust outcome type is a pure contract. Browser storage callers still
use the TypeScript operation result until repositories and adapters are ported.

## Repository Rule

Feature code will call repositories, not raw IndexedDB stores. Ledger-backed
writes must store resource rows and ledger rows atomically where IndexedDB
transaction support allows it.

Protected user data is never removed by cache pressure. Recoverable cache data
is removed only through cache-ledger dispatchers.

## IndexedDB Adapter

The host adapter owns requests, transactions, event listeners, timeout guards,
and late settlement tracking. Every pending operation has an owner and cleanup
path visible to memory counters.
