# Storage Kernel

## Purpose

This file defines Rust ownership for durable browser storage. Status:
design-only.

## Owner

`lkjstr-storage` owns the executable storage manifest, repositories, typed
outcomes, retention, cache ledger, repair, diagnostics, and table inventory.
`lkjstr-web` owns the IndexedDB host adapter.

## Manifest Contract

The Rust manifest must match
[../data/storage/data-classes/table-manifest.md](../data/storage/data-classes/table-manifest.md).
Repository checks compare executable manifest records with the Markdown table.

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

## Repository Rule

Feature code calls repositories, not raw IndexedDB stores. Ledger-backed writes
store resource rows and ledger rows atomically where IndexedDB transaction
support allows it.

Protected user data is never removed by cache pressure. Recoverable cache data
is removed only through cache-ledger dispatchers.

## IndexedDB Adapter

The host adapter owns requests, transactions, event listeners, timeout guards,
and late settlement tracking. Every pending operation has an owner and cleanup
path visible to memory counters.
