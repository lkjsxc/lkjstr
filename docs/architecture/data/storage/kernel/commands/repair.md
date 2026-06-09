# Repair And Search Commands

## Purpose

This file records storage command gaps that must stay conservative until real
row codecs, command specs, worker adapters, and focused tests exist. Repair
must report problems instead of silently classifying unknown rows as safe.

## Matrix

| Command id | Status | Family | Operation | Input type | Output type | Statements | Tables | Row codecs | Problems | Data classes | Ledger | Protection | Stats | Worker adapter | TypeScript retained | Focused tests | Delete |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `repair.scan-ledger` | not implemented | repair | repair | open | open | cache ledger scan open | `cache_ledger` | `sqlite_cache_ledger_row` | schema mismatch, corrupt rows, decode failures | ledger | repairs-ledger | mixed | cache-summary | cache maintenance | cache repositories | repair tests | Rust repair parity plus no-import proof |
| `repair.backfill-ledger` | not implemented | repair | repair | open | open | resource backfill open | prunable manifest tables | table codecs | orphan rows, backfill results | recoverable cache classes | repairs-ledger | mixed | cache-summary | cache maintenance | cache repositories | repair tests | Rust repair parity plus no-import proof |
| `repair.report-inventory` | not implemented | repair | repair | open | open | inventory report open | manifest tables | inventory rows | incomplete inventory, temporary memory fallback | metadata | none | inventory-only | inventory | cache maintenance | cache repositories | repair tests | Rust repair parity plus no-import proof |
| `search.local-query` | not implemented | search-index | read | open | open | search index query open | search token tables open | token row codecs open | cache decode | recoverable-cache | none | recoverable-cache | none | search storage path | search repositories | search tests | Rust Search parity plus no-import proof |
| `search.update-event-index` | not implemented | search-index | transaction | open | open | token update open | search token tables open | token row codecs open | cache decode, write/quota | recoverable-cache, ledger | same-batch | recoverable-cache | cache-summary | search storage path | search repositories | search tests | Rust Search parity plus no-import proof |
| `tag-lookup.by-value` | partial | search-index | read | open | open | `events.by_tag_value` | `events`, `event_tags` | `event_from_sqlite_row` | cache decode | recoverable-cache | none | recoverable-cache | none | `sqlite_store/events.rs` | event-matching repositories | event cache tests | Rust Search parity plus no-import proof |

## Inventory Exception

`storage-inventory.snapshot` is documented in [retention.md](retention.md) as
inventory-only. It uses storage-owned generated count SQL for known SQLite
schema tables instead of repository statement ids. Product code still must not
format table names or open SQLite directly.

## Repair Reporting

Repair reports schema mismatch, corrupt rows, decode failures, incomplete
inventory, temporary memory fallback, orphan ledger rows, orphan resource rows,
and backfill results. Unknown rows remain diagnostic until a safe owner and
resource kind are proved.
