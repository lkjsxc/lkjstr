# Query Runtime

## Purpose

Query runtime docs define how cache-first relay reads behave for Search and
Custom Request tools.

Status: Rust `lkjstr-app` owns a pure query-demand planner that composes
selected relays, route evidence, demand fingerprints, and wire requests.
TypeScript still owns product query execution.

## Render-Critical Kinds

| Tool           | Bootstrap / page                  | Live                                         |
| -------------- | --------------------------------- | -------------------------------------------- |
| Search         | User filter kinds (typically `1`) | Optional live tail when filter is open-ended |
| Custom Request | User-defined filters              | One-shot unless user starts live mode        |

## Lazy Hydration

- Search hydrates profile snippets for visible result rows only.
- Custom Request does not auto-hydrate metadata beyond result rows.

## Cursor Policy

- Cache-first; relay Demands through orchestrator with tool owner id.
- Page size `30`; compound cursors for feed-like results.
- Tools release Demands on tab close or filter change.

## Contract

- Cache is read before relay subscriptions start.
- Selected read relays are the base and fallback. Targeted query runtimes may
  add bounded protocol-derived routes.
- Feed-like tabs read cache pages through the shared repository.
- Relay results are written through the repository before UI state updates.
- Feed cursors track older and newer pages for cache and relay backfill.
- Feed pages use nonzero `limit`, compound cursors, bounded relay windows, and
  `hasMore` fields consistently.
- Relay feed pages apply cursor filters after relay collection, merge duplicate
  relay provenance, sort by `{created_at,id}`, and slice only after sorting.
- Initial page size is `30`.
- Home, Profile, and Global `loadOlder()` may scan multiple bounded complete
  windows from the current oldest cursor. Other query tools keep exact filters.
- `loadOlder()` clears `loadingOlder` in a `finally` path.
- A loading spinner may settle after the current bounded read produces enough
  rows or reaches a conservative unresolved frontier; `hasOlder` only becomes
  `false` after complete bounded relay coverage proves there is no older
  history for the requested filters.
- Loader failures surface bounded error text and keep the tab usable.
- `loadNewer()` restores newer chunks from the current newest cursor.
- Live reads set `since` at runtime start.
- Empty enabled-relay lists produce a visible no-enabled-relay state.
- Runtimes release orchestrator Demands when the owning tab unmounts.
- Runtimes ignore events for other subscription ids.
- Near-end detection uses scroll offset plus viewport size compared with total
  scroll size.
- Shared event list surfaces, including Home, Global, Thread, Search, and
  Author Context when paged, render an in-list loading row while
  `loadingOlder && hasOlder`.
- Terminal rows are only rendered when `hasOlder === false`.
