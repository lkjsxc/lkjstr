# Search

## Purpose

Search documents the user-facing query surface for cached and relay-backed
matches.

## Contract

- Search opens from New Tab.
- The query field opens empty, even when an active account exists.
- Search never populates the query from the active account.
- Search only runs after the user enters text and submits the form.
- Search does not require an active signing account.
- Search query text is preserved in feed `filterState` for tab switch and
  reload restore.
- Scroll position restores per Search tab after tab switching and reload.

## Local Search

- Cached event content is searched through a local SQLite search index.
- The preferred index is SQLite FTS only when the bundled SQLite WASM build is
  proven to expose it in focused tests.
- Otherwise the product uses a portable token index with event id, normalized
  token, token position, created_at, kind, and author columns.
- Event insert, delete, and compaction paths keep the search index consistent.
- Queries tokenize normalized text, intersect all token candidates, optionally
  verify phrase text against a bounded candidate set, then sort by compound
  `{created_at,id}` cursors.
- Normal local search must not scan every cached event row.

## Remote Search

- Queries send NIP-50 `search` filters to enabled read relays in the selected
  default relay set.
- Relays advertising NIP-50 in NIP-11 `supported_nips` are preferred.
- Relays with unknown support may receive bounded requests; ignored or
  unsupported `search` filters become diagnostics, not tab failure.
- Request-budget clamps and relay-support state are visible when known.
- Local indexed results render without waiting for remote relay completion.

## Result Merge

- Older search pages use compound `{createdAt,id}` cursors so same-second cached
  events are not skipped.
- Cached matches and relay matches are sorted by `{created_at,id}` and merged by
  real event id with all relay provenance preserved.
- Results render through the shared event row surface, footer phase, bounded
  short-feed viewport-fill, and automatic row-anchor restore.

## States

- `idle`: empty query or no submitted query.
- `local-searching`: local index query is running; submitted provider work
  must not render as ready until real local evidence arrives.
- `remote-searching`: relay NIP-50 reads are pending; submitted provider work
  must not render as ready until real relay evidence arrives.
- `partial`: local or some relay results are visible while other relay evidence
  is pending or incomplete.
- `unsupported`: selected relays are known not to support NIP-50; local results
  remain valid.
- `ready-empty`: local index and attempted relays produced no matches.
- `ready-with-results`: at least one real cached or relay event matched.
