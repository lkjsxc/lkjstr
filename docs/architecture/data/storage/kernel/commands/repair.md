# Repair And Search Commands

## Purpose

This file records storage command gaps that must stay conservative until real
row codecs, command specs, worker adapters, and focused tests exist. Repair
must report problems instead of silently classifying unknown rows as safe.

## Current Next Edit

1. Wait for retention delete-dispatch worker proof.
2. Split `crates/lkjstr-storage/src/outcome.rs` before adding repair labels if
   the extra labels would push that file over the source line cap.
3. Add repair scan, backfill, and inventory commands only with conservative
   target states.
4. Keep search/tag lookup blocked until storage row codecs and command specs are
   real.

## Required Stable Repair Problem Labels

Repair needs stable labels for `repair-schema-mismatch`, `repair-corrupt-row`,
`repair-decode-failure`, `repair-incomplete-inventory`,
`repair-temporary-memory-fallback`, `repair-orphan-ledger-row`,
`repair-orphan-resource-row`, `repair-backfill-inserted`,
`repair-backfill-updated`, `repair-skipped-unknown-row`, and
`repair-chunk-continuation`. Unknown rows remain diagnostic until a safe owner
and resource kind are proved.

## Matrix

| Command id | Status | Family | Operation | Input type | Output type | Statements | Tables | Row codecs | Problems | Data classes | Ledger | Protection | Stats | Worker adapter | TypeScript retained | Focused tests | Delete |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `repair.scan-ledger` | not implemented | repair | repair | open | open | cache ledger chunk scan and target probes open | `cache_ledger` plus target tables | `sqlite_cache_ledger_row` plus target codecs | required repair labels above | ledger, recoverable cache classes | repairs-ledger | mixed | cache-summary | cache maintenance | cache repositories | repair tests | Rust repair parity plus no-import proof |
| `repair.backfill-ledger` | not implemented | repair | repair | open | open | resource chunk scans and ledger upserts open | manifest-prunable tables with safe codecs | table codecs and `sqlite_cache_ledger_row` | required repair labels above | recoverable cache classes, ledger | repairs-ledger | mixed | cache-summary | cache maintenance | cache repositories | repair tests | Rust repair parity plus no-import proof |
| `repair.report-inventory` | not implemented | repair | repair | open | open | inventory report open | manifest tables | inventory rows | incomplete inventory, temporary memory fallback | metadata | none | inventory-only | inventory | cache maintenance | cache repositories | repair tests | Rust repair parity plus no-import proof |
| `search.local-query` | not implemented | search-index | read | open | open | search index query open | search token tables open | token row codecs open | cache decode | recoverable-cache | none | recoverable-cache | none | search storage path | search repositories | search tests | Rust Search parity plus no-import proof |
| `search.update-event-index` | not implemented | search-index | transaction | open | open | token update open | search token tables open | token row codecs open | cache decode, write/quota | recoverable-cache, ledger | same-batch | recoverable-cache | cache-summary | search storage path | search repositories | search tests | Rust Search parity plus no-import proof |
| `tag-lookup.by-value` | partial | search-index | read | open | open | `events.by_tag_value` | `events`, `event_tags` | `event_from_sqlite_row` | cache decode | recoverable-cache | none | recoverable-cache | none | `sqlite_store/events.rs` | event-matching repositories | event cache tests | Rust Search parity plus no-import proof |

## Open Cross-Reference

| Command id | Rust metadata file | SQL statement id | Manifest table | Row codec | Worker adapter function | TypeScript retained | Focused test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `repair.scan-ledger` | add `crates/lkjstr-storage/src/commands/repair.rs` | open cache ledger chunk scan and target probes | `cache_ledger` plus manifest prunable tables | `sqlite_cache_ledger_row` plus target codecs | add `sqlite_store/repair.rs` | cache maintenance repositories | `cargo test -p lkjstr-storage repair` |
| `repair.backfill-ledger` | add `crates/lkjstr-storage/src/commands/repair.rs` | open resource scans and ledger upserts | manifest prunable tables and `cache_ledger` | target codecs plus `sqlite_cache_ledger_row` | add `sqlite_store/repair.rs` | cache maintenance repositories | `cargo test -p lkjstr-web repair` |
| `repair.report-inventory` | add `crates/lkjstr-storage/src/commands/repair.rs` | inventory report open | manifest tables | inventory rows | add `sqlite_store/repair.rs` | cache maintenance repositories | `cargo test -p lkjstr-storage repair` |
| `search.local-query` | add `crates/lkjstr-storage/src/commands/search.rs` | search token query open | search token tables open | token row codecs open | add `sqlite_store/search.rs` | search-index repositories | `cargo test -p lkjstr-storage search` |
| `search.update-event-index` | add `crates/lkjstr-storage/src/commands/search.rs` | token delete and insert open | search token tables open | token row codecs open | add `sqlite_store/search.rs` | search-index repositories | `cargo test -p lkjstr-storage search` |
| `tag-lookup.by-value` | add or extend search metadata | `events.by_tag_value` | `events`, `event_tags` | `event_from_sqlite_row` | `sqlite_store/events.rs` first bridge | event-matching repositories | event cache and search tests |

## Inventory Exception

`storage-inventory.snapshot` is documented in [retention.md](retention.md) as
inventory-only. It uses storage-owned generated count SQL for known SQLite
schema tables instead of repository statement ids. Product code still must not
format table names or open SQLite directly.

## Repair Reporting

Repair reports schema mismatch, corrupt rows, decode failures, incomplete
inventory, temporary memory fallback, orphan ledger rows, orphan resource rows,
backfill results, skipped unknown rows, and chunk continuation. It never marks
unknown rows safe and never deletes protected account data, signing secrets,
settings, relay sets, workspace state, drafts, active jobs, active tab
snapshots, route blocks, or safety configuration.
