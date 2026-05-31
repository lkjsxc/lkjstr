# Local Cache Ledger

## Purpose

The local cache ledger is the shared byte-accounting and retention contract for
recoverable browser-local data.

## Contract

- `cacheLedger` is the durable IndexedDB ledger for every prunable cache
  resource.
- Cached Nostr events are one resource class in the ledger. They do not own a
  separate budget.
- Notifications are local activity cache by default. Recent, unread, visible,
  or account-window rows may be dynamically protected.
- Feed/page rows are derived cache by default. Open feed keys may be
  dynamically protected.
- Browser storage estimates remain authoritative for origin usage.
- IndexedDB table byte estimates are diagnostics, not browser quota truth.
- Compaction uses one selector and one deletion dispatcher for all ledger rows.
- Manual and automatic compaction must use the same policy.

## Whole-Origin Pressure Contract

`cache.maxBytes` is the target for whole browser origin usage when
`navigator.storage.estimate()` is available. It is not an event-row budget, a
ledger-row budget, a byte target for only ledger rows, or a row-count cap.

When browser usage is above the target, compaction may delete any eligible
prunable cache resource even when ledger-estimated bytes are below the target.
Compaction stops only when browser usage is under target, no eligible prunable
rows remain, or every remaining candidate is durably or dynamically protected.

`unknown` is not a success state. Unknown or browser-overhead bytes can mean
exact browser overhead, inventory timeout, unregistered table bytes, Cache
Storage bytes, localStorage bytes, IndexedDB internal or index overhead, or an
unsupported measurement path. Stats must make that state visible.

## Protected User Data

The ledger must not delete these records:

- Accounts and local signing secrets.
- Settings.
- Relay sets and user-owned relay enable/disable state.
- Tweet drafts.
- Workspace layout.
- Current workspace tab snapshots needed for recovery.
- Pending or running jobs.
- Latest active-account follow lists and latest metadata rows that the product
  marks as critical.
- Any explicit product-owned safety or configuration row.

## Prunable Cache Data

These rows must register in `cacheLedger` when persisted:

- Cached Nostr events, relay receipts, and tag rows.
- Read, hidden, muted, old, or out-of-window notification rows.
- Feed cursors.
- Feed coverage evidence.
- Feed scan hints.
- Finished jobs.
- Relay diagnostic summaries.
- Relay information documents.
- Relay list suggestions.
- Recoverable author relay route evidence.
- Stale tab snapshots for tabs absent from the current workspace.

## Ledger Health

Stats and repair checks use these ledger health fields:

| Field | Meaning |
| --- | --- |
| `totalLedgerRows` | all rows in `cacheLedger` |
| `prunableLedgerRows` | rows without durable protection |
| `protectedLedgerRows` | rows with durable protection |
| `orphanLedgerRows` | ledger rows whose target resource is absent |
| `missingLedgerRows` | prunable resource rows without a ledger row |
| `eligiblePruneRows` | candidates after durable and dynamic protection |
| `dynamicallyProtectedRows` | rows skipped because runtime state protects them |
| `ledgerBytes` | total ledger byte estimate |
| `prunableLedgerBytes` | byte estimate for non-durable-protected rows |
| `protectedLedgerBytes` | byte estimate for durable-protected rows |
| `averageLedgerBytesPerRow` | `ledgerBytes / totalLedgerRows` when rows exist |

Every new prunable table must land with a docs entry, ledger writer, byte
estimator, delete dispatcher, inventory group, repair/backfill behavior, and
unit coverage in the same change.

## Accounting

Each ledger row records owner kind, resource kind, resource id, score, creation
time, update time, byte estimate, durable protection flag, and optional
account, feed, relay, or reason fields.

`cacheBytes` estimates the resource plus directly owned derived rows. For
events, that includes the normalized event row, relay receipts, tag rows, and
the ledger row. For notifications and feed/page cache, it includes the resource
row and the ledger row. Estimates are deterministic and useful for ordering,
but browser quota remains the source of truth.

## Diagnostics

Stats must show:

- Browser usage.
- Site budget.
- Total ledger bytes.
- Prunable ledger bytes.
- Protected user data estimate.
- Unknown or browser overhead bytes.
- Ledger inventory by owner kind and resource kind.
- Last compaction reason, deleted resource count, and deleted byte estimate.

If usage remains high after all prunable rows are gone, Stats must identify
protected or unknown usage instead of reporting a silent success.
