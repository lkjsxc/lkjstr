# Cache

## Purpose

Cache docs define local event storage and diagnostics. Cache is not a New Tab
surface; status appears in Stats.

## Contract

- IndexedDB stores durable user data and prunable event-cache data. lkjstr does
  not impose an application item-count ceiling on cached events.
- Browser storage quotas and eviction are browser-defined. lkjstr still keeps
  its own site storage target for app-owned data instead of using a fixed event
  count cap.
- `cache.maxBytes` defaults to `67108864` bytes and is the enforced site
  storage target when browser estimates are available.
- Users do not configure event count, age, or compaction enablement in Settings.
- Runtime feed windows, relay read caps, and in-memory maps remain bounded.
  See [feed-memory.md](../../architecture/data/feed-memory.md) and
  [bounded-memory.md](../../architecture/data/bounded-memory.md).
- Budget compaction runs when event-cache byte accounting or total browser
  usage exceeds the effective site target. See
  [cache-budget.md](../../architecture/backend/cache-budget.md).
- Accounts, local signing secrets, settings, relay sets, workspace state,
  notifications, Tweet drafts, tab snapshots, and relay configuration are
  protected. Their estimated bytes reduce the amount of event cache that may
  remain, but they are never pruned by event-cache cleanup.
- If protected non-cache data alone exceeds the selected cache budget, lkjstr
  reports that condition honestly and does not delete protected records.

## Diagnostics

- Stats shows cache row counts, configured site budget bytes, effective
  event-cache target bytes, estimated event-cache bytes, browser storage
  estimate when available, last enforcement reason, pruned event count, pruned
  byte estimate, and protected-only status.
- Stats shows a storage inventory table with each IndexedDB table's row count,
  estimated bytes, ownership group, and the browser-overhead or unknown gap
  when the browser storage estimate is larger than table estimates.
- Event pruning removes relay receipts, tag rows, and feed cursors only when
  they reference pruned event data.
