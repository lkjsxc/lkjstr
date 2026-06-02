# Stats

## Purpose

Stats shows current-session relay counters and persisted operational summaries.

## Contract

- Stats opens from New Tab as the `network-stats` tab kind.
- It reads relay snapshots, cache status, SQLite worker health, persisted relay
  summaries, persisted job health, and runtime counters.
- It never creates relay subscriptions or changes relay settings.
- Manual refresh is always available.
- Optional auto-refresh polls every two seconds while enabled.
- Relay totals include open relays, active subscriptions, events, OK accepts,
  OK rejects, and sent plus received bytes.
- Relay diagnostics include local request caps, clamp reasons, NIP-11 stale or
  unavailable state, auth/payment/restriction warnings, timeouts, and
  event-limit reached state when known.
- Subscription rows use human-purpose labels such as Home live feed, Profile
  page read, Notifications live, Metadata, or Route discovery. Redacted raw ids
  are secondary only.
- Stats distinguishes raw relay wire subscriptions from orchestration counters:
  active demands, active leases, live leases, bootstrap/page reads, and
  in-flight reads.
- Cache status includes event, profile, notification, site budget bytes,
  browser origin usage, physical object-store bytes, ledger-accounted resource
  bytes, prunable cache bytes, protected ledger bytes, protected user estimate,
  derived page/feed cache bytes, diagnostics and metadata bytes, localStorage
  bytes, Cache Storage bytes, unknown old or unowned storage bytes, residual
  browser overhead, inventory scan status, ledger inventory by resource kind,
  ledger row count, orphan ledger rows, missing ledger rows, last repair result,
  last enforcement reason, pruned resource count, pruned byte estimate, skipped
  candidate counts, and pressure state.
- Cache status must show exact rows for browser usage, site target, remaining
  over-target bytes, physical IndexedDB bytes, ledger-accounted bytes,
  prunable ledger bytes, protected estimate, derived feed cache bytes,
  diagnostics bytes, localStorage bytes, Cache Storage bytes, unknown or
  unowned bytes, residual overhead bytes, inventory scan status, ledger row
  count, orphan ledger rows, missing ledger rows, last repair result, last
  compaction result, pruned resources, pruned bytes, and pressure state.
- Manual cache actions are `Refresh storage inventory`, `Compact now`, and
  `Repair storage`. They use real storage paths and are never placeholders.
  Repair fixes missing or stale ledger rows, deletes orphan ledger rows, removes
  safe unowned cache rows, and deletes only obsolete recoverable old stores
  or databases. If a browser profile has blocked, unavailable, or
  schema-incomplete storage, the actions report through the normal cache status
  path and keep the tab usable. `Compact now` may fall back to the displayed
  site target when the settings store cannot be read.
- SQLite storage health shows persistent OPFS or temporary memory mode, VFS,
  worker kind, SQLite library text, database name, page counts, event count,
  relay receipt count, tag row count, schema change count, and warnings.
- Temporary memory mode shows the exact warning that changes may disappear when
  the browser session ends.
- Cache diagnostic reads must treat missing IndexedDB object stores as
  unavailable inventory or ledger status. They must not reject the Stats refresh
  promise or repeat uncaught `NotFoundError` entries in the console.
- Cache diagnostic loops must await every asynchronous store read directly.
  Async callbacks passed to IndexedDB cursor helpers are not allowed because
  their rejections can escape the diagnostic fallback path.
- Runtime memory shows compact app-owned counters: app log count, relay
  suppression count, in-flight reads, fallback repository counts, reference
  cache size, profile cache size, token cache size, relay snapshot totals,
  orchestration demand and lease counts (active, live, bootstrap), relay REQ and
  CLOSE totals, events received vs accepted vs dropped, and optional JavaScript
  heap.
- Runtime memory output is redacted count data only. It must not expose raw
  events, relay payloads, tab ids, request ids, or log messages.

## Rust Migration Status

- The Rust/WASM shell renders a partial Stats body with real workspace counters
  and manifest-backed IndexedDB table counts.
- Rust Stats may show unavailable rows for relay snapshots, job health,
  compaction, repair, browser quota, or memory data until each provider exists.
- Unavailable rows must be explicit; they must not use fake counters or
  synthetic relay/cache records.
