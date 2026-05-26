# Retention Compaction

## Purpose

Retention compaction is an optional quota-pressure path for cached events. It
is not a routine item-count budget.

## Contract

- lkjstr does not keep cached events near a fixed internal event count.
- Compaction does not run on a schedule for steady-state cache size control.
- Compaction may run only when durable storage is near browser quota or after
  an explicit diagnostic recovery action.
- Selection uses the `eventPriority` score index ascending. No
  `events.orderBy('created_at').each` full scan.
- Each batch removes event rows, relay receipts, tag rows, and feed cursors that
  reference pruned ids.
- Accounts, settings, relay sets, workspace layout, notifications, and Tweet
  drafts are never pruned by event compaction.
- `cacheMeta` records last compaction counts and timestamps for Stats when a
  quota-pressure pass runs.

## Quota Pressure

- When invoked, evict lowest scores until estimated durable usage is below the
  safe threshold or only protected rows remain.
- Hard-protected kinds and pinned ids never score-evict. See
  [score-policy.md](score-policy.md).

## Settings Removal

- `cache.maxEvents`, `cache.maxAgeDays`, and `cache.compactionEnabled` are
  removed from the settings schema and UI.
- Importing legacy settings ignores those keys.
