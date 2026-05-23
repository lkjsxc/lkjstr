# Cache

## Purpose

Stats exposes local storage counts and compaction remains an internal cache
operation.

## Contract

- Stats shows event, profile, notification, storage estimates, persisted relay
  summaries, and persisted job health summaries.
- Compaction prunes old cache events through the cache module by Settings
  values for age, count, and enablement.
- Defaults are `30` days and `5000` events.
- `cache.compactionEnabled=false` skips deletion and reports that compaction
  was disabled.
- Event pruning removes relay receipts, tag rows, and feed cursors only when
  they reference pruned event data.
- Accounts, settings, relay sets, workspace state, and notifications are
  protected from event cache pruning.
