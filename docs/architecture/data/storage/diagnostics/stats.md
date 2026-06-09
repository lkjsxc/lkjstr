# Stats Contract

## Purpose

Stats turns storage manifest, SQLite health, ledger, inventory, quota, and
operation results into a readable diagnostic surface.

## Storage Health

The initial loading state is short-lived. After a bounded deadline each storage
provider resolves to one of these states:

| State | Meaning |
| --- | --- |
| `available` | persistent SQLite worker storage is open |
| `temporary-memory` | SQLite worker is open without persistent OPFS |
| `unavailable` | storage worker or browser storage cannot be used |
| `timeout` | health or inventory did not answer before the deadline |
| `blocked` | browser policy, lock, or user setting blocked access |
| `corrupt` | schema or row validation found corruption |
| `unknown-old-storage` | old browser storage exists but cannot be classified |

Stats must not show indefinite text such as storage health has not been read.
The Rust UI bounds provider reads with a timeout snapshot while worker calls
keep their typed deadlines. Timeout and unavailable states are explicit
diagnostic rows. Pressure fields come from a real pressure snapshot row or an
explicit unavailable reason; Stats must not invent byte counts.
Rust Stats renders pressure byte-summary rows for browser usage, site target,
protected, prunable, unknown or unowned, and residual overhead classes. Missing
pressure data keeps those rows visible as unavailable instead of showing zero.

## Groups

Stats groups bytes as:

- protected user data;
- protected safety data;
- SQLite table estimates;
- ledger-accounted resource bytes;
- prunable cache;
- derived feed cache;
- diagnostics;
- cache metadata;
- metadata;
- localStorage;
- Cache Storage;
- old IndexedDB database presence;
- unknown old or unowned storage;
- residual browser overhead.

## Required Fields

Stats shows browser usage, site budget, storage mode, schema readiness, total
ledger bytes, prunable ledger bytes, protected estimates, localStorage bytes,
Cache Storage bytes, overhead, unknown or unowned bytes, inventory status,
ledger rows by owner and resource kind, physical SQLite rows by table, old
IndexedDB database presence, last compaction reason, deleted resource count, and
deleted byte estimate.

Operation diagnostics distinguish durable success, unavailable storage,
timeout, quota failure, blocked storage, corrupt rows, and late-settled work.

## Action Contract

Stats exposes manual refresh, compact, and repair actions. Actions enqueue
background tasks and return immediate UI feedback. Repair fixes missing or stale
ledger rows, deletes orphan ledger rows, removes safe unowned cache rows, and
deletes only old stores or databases classified as obsolete and recoverable.

Compact uses browser origin usage when available and keeps deleting bounded
batches of prunable ledger resources until the site budget is met or a stop
reason explains why it cannot continue.

## Rule

Stats must be useful when storage is degraded. It reports unavailable, partial,
timeout, or unknown states instead of throwing or showing zero-byte success.
