# Search Commands

## Purpose

Search command metadata covers storage-owned local token rows and tag lookup
queries. It does not claim Search surface parity or relay NIP-50 merge behavior.

## Status

Implemented at the storage and web-adapter boundary. App planning, relay
NIP-50 merge, Leptos parity, and TypeScript deletion proof remain open.

## Commands

### `tag-lookup.by-value`

- Status: implemented.
- Family: search-index.
- Operation: read.
- Input type: `TagLookupByValueInput`.
- Output type: `TagLookupByValueOutput`.
- Statements: `events.by_tag_value`.
- Tables: `events`, `event_tags`.
- Row codecs: `event_from_sqlite_row`.
- Problems: cache decode.
- Data classes: recoverable-cache.
- Ledger: none.
- Protection: recoverable-cache.
- Stats: none.
- Worker adapter: `sqlite_store/events.rs` tag bridge.
- TypeScript retained: `event-matching-store.ts` and
  `event-matching-sqlite.ts`.
- Focused tests: `commands_search_test.rs`.
- Delete condition: Search parity plus no-import proof.

### `search.update-event-index`

- Status: implemented at the event-write boundary.
- Family: search-index.
- Operation: transaction.
- Input type: `SearchUpdateEventIndexInput`.
- Output type: `SearchUpdateEventIndexOutput`.
- Statements: `event_search_tokens.delete_by_event` and
  `event_search_tokens.upsert`.
- Tables: `event_search_tokens`.
- Row codecs: `sqlite_event_search_token_rows`.
- Problems: cache decode and write or quota failure.
- Data classes: recoverable-cache.
- Ledger: event cache resource owner handles the same cached event write.
- Protection: recoverable-cache.
- Stats: none.
- Worker adapter: `sqlite_store/search.rs` token batch steps.
- TypeScript retained: `search-index-store.ts` and
  `search-index-sqlite.ts`.
- Focused tests: `search_test.rs` and `commands_search_test.rs`.
- Delete condition: Search parity plus no-import proof.

### `search.local-query`

- Status: implemented at the storage and web-adapter boundary; app parity is
  pending.
- Family: search-index.
- Operation: read.
- Input type: `SearchLocalQueryInput`.
- Output type: `SearchLocalQueryOutput`.
- Statements: `event_search_tokens.by_token` and `events.select`.
- Tables: `event_search_tokens` and `events`.
- Row codecs: `sqlite_event_search_token_row` and `event_from_sqlite_row`.
- Problems: cache decode.
- Data classes: recoverable-cache.
- Ledger: none.
- Protection: recoverable-cache.
- Stats: none.
- Worker adapter: `sqlite_store/search.rs` indexed local query.
- TypeScript retained: `search-index-store.ts` and
  `search-index-sqlite.ts`.
- Focused tests: `search_test.rs`, `commands_search_test.rs`, and
  `cargo test -p lkjstr-web sqlite_store` compile proof.
- Delete condition: Search parity plus no-import proof.

## Batch Rule

Event cache writes delete prior token rows for the event before inserting the
new event-derived token rows. Token rows are child rows of `events` and cascade
with event deletion; the event cache ledger row remains the resource owner.

## Boundary

Storage owns token row codecs, tag lookup metadata, and indexed local candidate
commands. `lkjstr-web` executes the typed worker steps. Product ranking, NIP-50
relay merge, cancellation, and Search UI states belong to later `lkjstr-app`,
relay, and `lkjstr-ui` work.
