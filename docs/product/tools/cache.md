# Cache

## Purpose

Cache docs define local cache storage and diagnostics. Cache is not a New Tab
surface; status appears in Stats.

## Contract

- IndexedDB stores durable user data and prunable local-cache data. lkjstr does
  not impose an application item-count ceiling on cached resources.
- Browser storage quotas and eviction are browser-defined. lkjstr still keeps
  its own site storage target for app-owned data instead of using a fixed event
  count cap.
- `cache.maxBytes` defaults to `67108864` bytes and is the enforced site
  storage target when browser estimates are available.
- Users do not configure cache row count, row age, or compaction enablement in
  Settings.
- Runtime feed windows, relay read caps, and in-memory maps remain bounded.
  See [feed-memory.md](../../architecture/data/feed-memory.md) and
  [bounded-memory.md](../../architecture/data/bounded-memory.md).
- Budget compaction runs when ledger-accounted resource bytes or browser origin
  usage exceeds the effective site target. Browser origin usage is authoritative
  when available. See
  [cache-budget.md](../../architecture/backend/cache-budget.md).
- Accounts, local signing secrets, settings, relay sets, workspace state, Tweet
  drafts, active tab snapshots, active jobs, and relay configuration are
  protected. Notifications and feed/page rows are local cache with protected
  subsets, not globally protected user data.
- If protected non-cache data alone exceeds the selected cache budget, lkjstr
  reports that condition honestly and does not delete protected records.

## Diagnostics

- Stats shows cache row counts, configured site budget bytes, browser origin
  usage, physical object-store bytes, ledger-accounted resource bytes,
  prunable ledger bytes, protected user data estimate, unknown old or
  unowned bytes, residual browser overhead, last enforcement reason, pruned
  resource count, pruned byte estimate, and remaining pressure cause.
- Stats shows a storage inventory table with each IndexedDB database and object
  store, row count, estimated bytes, ownership group, and scan status. Unknown
  or old stores are visible rows, not hidden in residual browser overhead
  when database enumeration is available.
- Stats shows ledger inventory by owner kind and resource kind so
  notification-heavy and page-heavy pressure is visible.
- Manual repair uses SQLite cache-ledger health and repair; it only deletes
  orphan ledger rows after the target table was read and the target primary key
  was definitely missing.
- Event pruning removes relay receipts, tag rows, and affected feed evidence.
  Notification pruning does not delete source events unless their event ledger
  rows are also selected.
