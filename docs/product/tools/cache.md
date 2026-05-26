# Cache

## Purpose

Cache docs define local event storage and diagnostics. Cache is not a New Tab
surface; status appears in Stats.

## Contract

- IndexedDB is the durable event cache. lkjstr does not impose an application
  item-count ceiling on cached events.
- Browser storage quotas and eviction are browser-defined. lkjstr does not
  replace browser quota management with a fixed event count cap.
- Users do not configure event count, age, or compaction enablement in
  Settings.
- Runtime feed windows, relay read caps, and in-memory maps remain bounded.
  See [feed-memory.md](../../architecture/data/feed-memory.md) and
  [bounded-memory.md](../../architecture/data/bounded-memory.md).
- Optional quota-pressure compaction may run only when durable storage is near
  browser limits. It is not part of normal steady-state operation. See
  [retention/compaction.md](../../architecture/data/retention/compaction.md).
- Accounts, settings, relay sets, workspace state, notifications, and Tweet
  drafts are never pruned by event cache cleanup.

## Diagnostics

- Stats shows cache row counts, last optional compaction metadata, and storage
  health when available.
- Event pruning removes relay receipts, tag rows, and feed cursors only when
  they reference pruned event data.
