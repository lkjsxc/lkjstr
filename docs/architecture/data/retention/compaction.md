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
- Evict the lowest-score prunable ledger rows until browser usage is under
  target, ledger bytes are under target and browser usage is unavailable, no
  prunable candidates remain, or only dynamically protected rows remain.
- Do not stop only because event bytes are low. Notification-heavy and
  page-heavy pressure must continue selecting those resource classes.
- If browser usage remains above target after all prunable cache rows are gone,
  report protected or unknown usage instead of silently succeeding.
- Account-critical protected records, active tab snapshots, active jobs, open
  feed keys, newest retained notifications, and currently pinned runtime ids
  never score-evict. See [score-policy.md](score-policy.md).

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
