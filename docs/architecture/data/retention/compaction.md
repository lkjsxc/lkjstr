# Retention Compaction

## Purpose

Retention compaction keeps estimated site storage within the configured byte
target by pruning cached events. It is not an event-count budget.

## Contract

- lkjstr does not keep cached events near a fixed internal event count.
- Compaction runs when event-cache bytes exceed their effective allowance,
  total browser usage exceeds the site target, browser quota estimates report
  pressure, or after an explicit diagnostic recovery action.
- Selection uses the `eventPriority` score index ascending. No
  `events.orderBy('created_at').each` full scan.
- Each batch removes event rows, relay receipts, tag rows, and feed cursors that
  reference pruned ids.
- Accounts, local signing secrets, settings, relay sets, workspace layout,
  notifications, Tweet drafts, tab snapshots, relay configuration, and other
  protected non-cache records are never pruned by event compaction.
- `cacheMeta` records site budget bytes, effective event-cache target bytes,
  estimated event-cache bytes, browser usage bytes, pruned event count, pruned
  byte estimate, skipped reason, timestamps, and protected-only status.

## Budget Pressure

- When invoked, estimate protected and non-event usage, subtract it from the
  site target, and evict lowest scores until event-cache bytes are below that
  effective event-cache target or only protected rows remain.
- Browser storage usage above `cache.maxBytes` or quota ratio above `0.9`
  reduces the event-cache target, but compaction still deletes only prunable
  event-cache rows.
- If browser usage remains high while event-cache bytes are already under
  budget, report protected or non-cache usage instead of deleting user records.
- Account-critical protected records and currently pinned runtime ids never
  score-evict. See [score-policy.md](score-policy.md).

## Settings Removal

- `cache.maxEvents`, `cache.maxAgeDays`, and `cache.compactionEnabled` are
  removed from the settings schema and UI.
- Importing removed settings ignores those keys.
