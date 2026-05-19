# Cache

## Purpose

The Cache tab exposes local storage counts and compaction controls.

## Contract

- Cache shows event, profile, notification, Tweet draft, and storage estimates.
- Compaction prunes old cache events through the cache module by Settings
  values for age, count, and enablement.
- Defaults are `30` days and `5000` events.
- `cache.compactionEnabled=false` skips deletion and reports that compaction
  was disabled.
- Event pruning removes relay receipts, tag rows, and feed cursors only when
  they reference pruned event data.
- Durable Tweet drafts are not removed by automatic cache pruning.
- Accounts, settings, relay sets, workspace state, and notifications are
  protected from event cache pruning.
