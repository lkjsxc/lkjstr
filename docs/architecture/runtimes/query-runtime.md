# Query Runtime

## Purpose

Query runtime docs define how cache-first relay reads behave.

## Contract

- Cache is read before relay subscriptions start.
- Selected read relays are the base and fallback. Targeted query runtimes may
  add bounded protocol-derived routes.
- Feed-like tabs read cache pages through the shared repository.
- Relay results are written through the repository before UI state updates.
- Feed cursors track older and newer pages for cache and relay backfill.
- Feed pages use nonzero `limit`, compound cursors, interval boundaries, and
  `hasMore` fields consistently.
- Relay feed pages apply cursor filters after relay collection, merge duplicate
  relay provenance, sort by `{created_at,id}`, and slice only after sorting.
- Initial page size is `30`.
- `loadOlder()` loads one bounded page using the current oldest cursor.
- `loadOlder()` clears `loadingOlder` in a `finally` path.
- Loader failures surface bounded error text and keep the tab usable.
- `loadNewer()` restores newer chunks from the current newest cursor.
- Live reads set `since` at runtime start.
- Empty enabled-relay lists produce a visible no-enabled-relay state.
- Runtimes close their relay subscriptions when the owning tab unmounts.
- Runtimes ignore events for other subscription ids.
- Near-end detection uses scroll offset plus viewport size compared with total
  scroll size.
