# Query Runtime

## Purpose

Query runtime docs define how cache-first relay reads behave.

## Contract

- Cache is read before relay subscriptions start.
- Relay reads use enabled read relays from the selected default relay set.
- Feed-like tabs read cache pages through the shared repository.
- Relay results are written through the repository before UI state updates.
- Feed cursors track older pages for cache and relay backfill.
- Feed pages use `limit`, `until`, cursor, and `hasMore` fields consistently.
- Initial page size is `30`.
- `loadOlder()` loads one bounded page using the current oldest timestamp.
- `resetToLatest()` clears older window state and loads the newest page.
- Live reads set `since` at runtime start.
- Empty enabled-relay lists produce a visible no-enabled-relay state.
- Runtimes close their relay subscriptions when the owning tab unmounts.
- Runtimes ignore events for other subscription ids.
