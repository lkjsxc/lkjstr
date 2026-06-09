# Event Cache Commands

## Purpose

Event cache command metadata covers cached Nostr events, tag rows, relay
provenance rows, and same-batch cache ledger writes. Cache misses are not proof
of absence.

## Matrix

| Command id | Status | Family | Operation | Input type | Output type | Statements | Tables | Row codecs | Problems | Data classes | Ledger | Protection | Stats | Worker adapter | TypeScript retained | Focused tests | Delete |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `event-cache.event.put` | implemented | event-cache | transaction | `EventPutInput` | `EventPutOutput` | `events.upsert`, `event_tags.delete_by_event`, `event_tags.upsert`, `event_relays.upsert`, `cache_ledger.upsert` | `events`, `event_tags`, `event_relays`, `cache_ledger` | `sqlite_event_row`, `sqlite_event_tag_rows`, `sqlite_event_relay_row`, `sqlite_cache_ledger_row` | cache decode, write/quota | recoverable-cache, ledger | same-batch | recoverable-cache | cache-summary | `sqlite_store/events.rs` | `events-store.ts`, `events-sqlite.ts` | `commands_event_cache_test.rs` | Rust feed parity plus no-import proof |
| `event-cache.event.get` | implemented | event-cache | read | `EventGetInput` | `EventGetOutput` | `events.select` | `events` | `event_from_sqlite_row` | cache decode | recoverable-cache | none | recoverable-cache | none | `sqlite_store/events.rs` | `events-store.ts`, `events-sqlite.ts` | `commands_event_cache_test.rs` | Rust feed parity plus no-import proof |
| `event-cache.event-relays` | implemented | event-cache | read | `EventRelaysInput` | `EventRelaysOutput` | `event_relays.by_event` | `event_relays` | `sqlite_event_relay_row` | cache decode | recoverable-cache | none | recoverable-cache | none | `sqlite_store/events.rs` | `events-store.ts`, `events-sqlite.ts` | `commands_event_cache_test.rs` | Rust feed parity plus no-import proof |
| `event-cache.events-by-tag-value` | implemented | event-cache | read | `EventsByTagValueInput` | `EventsByTagValueOutput` | `events.by_tag_value` | `events`, `event_tags` | `event_from_sqlite_row` | cache decode | recoverable-cache | none | recoverable-cache | none | `sqlite_store/events.rs` | `events-store.ts`, `events-sqlite.ts` | `commands_event_cache_test.rs` | Rust feed parity plus no-import proof |
| `event-cache.events-by-kind` | implemented | event-cache | read | `EventsByKindInput` | `EventsByKindOutput` | `events.by_kind_time` | `events` | `event_from_sqlite_row` | cache decode | recoverable-cache | none | recoverable-cache | none | `sqlite_store/events.rs` | `events-store.ts`, `events-sqlite.ts` | `commands_event_cache_test.rs` | Rust feed parity plus no-import proof |
| `event-cache.events-by-author-kind` | implemented | event-cache | read | `EventsByAuthorKindInput` | `EventsByAuthorKindOutput` | `events.by_pubkey_kind_time` | `events` | `event_from_sqlite_row` | cache decode | recoverable-cache | none | recoverable-cache | none | `sqlite_store/events.rs` | `events-store.ts`, `events-sqlite.ts` | `commands_event_cache_test.rs` | Rust feed parity plus no-import proof |

## Batch Rule

`event-cache.event.put` writes the event row, replaces child tag rows, records
relay provenance rows, and writes the matching `cache_ledger` row in one worker
batch. A later best-effort ledger write is not allowed.
