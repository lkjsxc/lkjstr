# Retention Compaction

## Purpose

Retention compaction keeps estimated site storage within the configured byte
target by pruning recoverable local cache resources. It is not a row-count
budget.

## Contract

- lkjstr does not keep cached resources near a fixed internal row count.
- Compaction runs when ledger bytes exceed the site target, total browser usage
  exceeds the site target, browser quota estimates report pressure, or after an
  explicit diagnostic recovery action.
- Selection uses the `cacheLedger` score index ascending. Normal compaction does
  not scan resource tables such as `events`, `notifications`, or `feedCoverage`.
- Each batch dispatches deletion by `resourceKind`.
- Event deletion removes event rows, relay receipts, tag rows, affected ledger
  rows, stale feed cursors, and coverage rows that depended on deleted events.
- Notification deletion removes only notification rows and their ledger rows.
- Feed/page deletion removes cursors, coverage rows, or scan hints without
  deleting events.
- Diagnostics deletion removes recoverable relay summaries, relay information,
  suggestions, route evidence, or finished job rows without touching user relay
  configuration.
- `cacheMeta` records site budget bytes, browser usage bytes, ledger bytes,
  prunable bytes, protected estimate, unknown or overhead bytes, pruned resource
  count, pruned byte estimate, skipped reason, timestamps, and protected-only or
  unknown-only status.

## Budget Pressure

- Browser `navigator.storage.estimate()` remains authoritative for origin usage
  when available. IndexedDB table estimates are diagnostics, not quota truth.
- When invoked, estimate protected user bytes, prunable ledger bytes, and
  unknown or overhead bytes.
- Do not stop only because event bytes are low. Notification-heavy and
  page-heavy pressure must continue selecting those resource classes.
- If browser usage remains above target after all prunable cache rows are gone,
  report protected or unknown usage instead of silently succeeding.
- Account-critical protected records, active tab snapshots, active jobs, open
  feed keys, newest retained notifications, and currently pinned runtime ids
  never score-evict. See [score-policy.md](score-policy.md).

## Algorithm

1. Read settings and derive the site budget.
2. Read `navigator.storage.estimate()` when available.
3. Read the ledger summary.
4. If browser usage is above the site budget and any eligible prunable ledger
   rows exist, compact.
5. If browser usage is unavailable, compact when prunable ledger bytes exceed
   the site budget.
6. If quota pressure exists, compact any eligible prunable ledger rows.
7. Delete by `resourceKind` through the shared dispatcher.
8. Re-read real browser quota after each batch when available.
9. Stop only when usage is under budget, no eligible candidates remain, or only
   protected candidates remain.
10. Persist the exact pressure state.

## Pressure States

| State | Meaning |
| --- | --- |
| `below-budget` | browser usage or ledger fallback is under target |
| `compacted-under-budget` | compaction brought usage under target |
| `candidate-limited` | eligible rows were deleted but pressure remains |
| `protected-only` | only durable or dynamic protected rows remain |
| `unknown-only` | pressure remains without known prunable bytes |
| `inventory-incomplete` | inventory timed out or could not account for usage |
| `quota-unavailable` | browser quota estimate is unavailable |
| `storage-api-unavailable` | browser storage APIs are unsupported |

## Stats Contract

Stats must show:

- Browser usage.
- Site budget.
- Prunable cache bytes.
- Protected user data estimate.
- Unknown/browser overhead.
- Ledger rows and byte estimates by owner kind and resource kind.
- Last compaction reason, deleted resource count, and deleted byte estimate.
- Whether remaining pressure is protected-only, unknown-only, or candidate
  limited.

## Settings Removal

- `cache.maxEvents`, `cache.maxAgeDays`, and `cache.compactionEnabled` are
  removed from the settings schema and UI.
- Importing removed settings ignores those keys.
