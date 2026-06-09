# Search Commands

## Purpose

Search command metadata covers storage-owned local token rows and tag lookup
queries. It does not claim Search surface parity or relay NIP-50 merge behavior.

## Matrix

| Command id | Status | Family | Operation | Input type | Output type | Statements | Tables | Row codecs | Problems | Data classes | Ledger | Protection | Stats | Worker adapter | TypeScript retained | Focused tests | Delete |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `tag-lookup.by-value` | implemented | search-index | read | `TagLookupByValueInput` | `TagLookupByValueOutput` | `events.by_tag_value` | `events`, `event_tags` | `event_from_sqlite_row` | cache decode | recoverable-cache | none | recoverable-cache | none | `sqlite_store/events.rs` | `event-matching-store.ts`, `event-matching-sqlite.ts` | `commands_search_test.rs` | Search parity plus no-import proof |
| `search.update-event-index` | implemented | search-index | transaction | `SearchUpdateEventIndexInput` | `SearchUpdateEventIndexOutput` | `event_search_tokens.delete_by_event`, `event_search_tokens.upsert` | `event_search_tokens` | `sqlite_event_search_token_rows` | cache decode, write/quota | recoverable-cache | none | recoverable-cache | none | event put token batch bridge | `search-index-store.ts`, `search-index-sqlite.ts` | `search_test.rs`, `commands_search_test.rs` | Search parity plus no-import proof |
| `search.local-query` | metadata only | search-index | read | `SearchLocalQueryInput` | `SearchLocalQueryOutput` | `event_search_tokens.by_token`, `events.select` | `event_search_tokens`, `events` | `sqlite_event_search_token_row`, `event_from_sqlite_row` | cache decode | recoverable-cache | none | recoverable-cache | none | pending `sqlite_store/search.rs` local query adapter | `search-index-store.ts`, `search-index-sqlite.ts` | `commands_search_test.rs` | Search parity plus no-import proof |

## Batch Rule

Event cache writes delete prior token rows for the event before inserting the
new event-derived token rows. Token rows are child rows of `events` and cascade
with event deletion; the event cache ledger row remains the resource owner.

## Boundary

Storage owns token row codecs, tag lookup metadata, and indexed local candidate
commands. Product ranking, NIP-50 relay merge, cancellation, and Search UI
states belong to later `lkjstr-app`, relay, and `lkjstr-ui` work.
