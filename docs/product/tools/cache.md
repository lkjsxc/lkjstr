# Cache

## Purpose

Cache docs define local event pruning behavior.

## Contract

- Compaction prunes old cache events through the cache module by Settings
  values for age, count, and enablement.
- Defaults are `30` days and `5000` events.
- `cache.compactionEnabled=false` skips deletion and reports that compaction
  was disabled.
- Event pruning removes relay receipts, tag rows, and feed cursors only when
  they reference pruned event data.
- Accounts, settings, relay sets, workspace state, and notifications are
  protected from event cache pruning.
