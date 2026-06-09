# Repair And Search Commands

## Purpose

This file records repair and search command coverage. Repair stays
conservative: it reports problems and planned backfills before any cleanup path
may delete or rewrite rows. Unknown rows are never silently marked safe.

## Current Next Edit

1. Add physical target probes for repair chunks without exposing raw SQL.
2. Keep repair deletion disabled until reporting, backfill, target probes,
   deadlines, cancellation, and late-settlement behavior are verified together.
3. Keep search/tag lookup blocked until storage row codecs and command specs are
   real.

## Stable Repair Finding Labels

Repair reports the unprefixed finding labels `schema-mismatch`, `corrupt-row`,
`decode-failure`, `orphan-ledger-row`, `orphan-resource-row`,
`incomplete-inventory`, `temporary-memory-mode`, `unknown-unowned-row`,
`skipped-unknown-row`, `backfill-planned`, `backfill-applied`, and
`chunk-continuation`. Command metadata exposes matching `repair-*` problem
kinds for storage outcomes.

## Matrix

| Command id | Status | Family | Operation | Input type | Output type | Statements | Tables | Row codecs | Problems | Data classes | Ledger | Protection | Stats | Worker adapter | TypeScript retained | Focused tests | Delete |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `repair.scan-ledger` | typed model and adapter implemented; target probes pending | repair | repair | `RepairScanInput` | `RepairScanOutput` | `cache_ledger.select` | `cache_ledger` plus manifest recoverable tables | `sqlite_cache_ledger_row`, `repair_scan_row`, `repair_finding` | repair labels above | ledger, recoverable cache, derived feed cache, diagnostics cache, metadata | repairs-ledger | mixed | cache-summary | `sqlite_store/repair.rs` maps health and outcomes | cache repositories | `cargo test -p lkjstr-storage repair`; `cargo test -p lkjstr-web repair` | Rust repair parity plus no-import proof |
| `repair.backfill-ledger` | typed model and adapter implemented; product use pending | repair | repair | `RepairBackfillInput` | `RepairBackfillOutput` | `cache_ledger.upsert` | `cache_ledger` plus manifest recoverable tables | `sqlite_cache_ledger_row`, `repair_backfill_plan`, `repair_finding` | repair labels above | ledger, recoverable cache, derived feed cache, diagnostics cache | repairs-ledger | mixed | cache-summary | `sqlite_store/repair.rs` batches storage-approved ledger rows | cache repositories | `cargo test -p lkjstr-storage repair`; `cargo test -p lkjstr-web repair` | Rust repair parity plus no-import proof |
| `repair.report-inventory` | typed model and adapter implemented; product use pending | repair | repair | `RepairInventoryReportInput` | `RepairInventoryReportOutput` | inventory-only generated counts | manifest tables | `repair_inventory_report`, `repair_finding` | incomplete inventory, temporary memory mode, chunk continuation | metadata | none | inventory-only | inventory | `sqlite_store/repair.rs` maps health and outcomes | cache repositories | `cargo test -p lkjstr-storage repair`; `cargo test -p lkjstr-web repair` | Rust repair parity plus no-import proof |
| `search.local-query` | not implemented | search-index | read | open | open | search index query open | search token tables open | token row codecs open | cache decode | recoverable-cache | none | recoverable-cache | none | search storage path | search repositories | search tests | Rust Search parity plus no-import proof |
| `search.update-event-index` | not implemented | search-index | transaction | open | open | token update open | search token tables open | token row codecs open | cache decode, write/quota | recoverable-cache, ledger | same-batch | recoverable-cache | cache-summary | search storage path | search repositories | search tests | Rust Search parity plus no-import proof |
| `tag-lookup.by-value` | partial | search-index | read | open | open | `events.by_tag_value` | `events`, `event_tags` | `event_from_sqlite_row` | cache decode | recoverable-cache | none | recoverable-cache | none | `sqlite_store/events.rs` first bridge | event-matching repositories | event cache and search tests | Rust Search parity plus no-import proof |

## Open Cross-Reference

| Command id | Rust metadata file | SQL statement id | Manifest table | Row codec | Worker adapter function | TypeScript retained | Focused test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `repair.scan-ledger` | `crates/lkjstr-storage/src/commands/repair.rs` | `cache_ledger.select` | `cache_ledger` plus manifest recoverable tables | `sqlite_cache_ledger_row`, `repair_scan_row`, `repair_finding` | `sqlite_store/repair.rs` health/outcome adapter | cache maintenance repositories | `cargo test -p lkjstr-storage repair`; `cargo test -p lkjstr-web repair` |
| `repair.backfill-ledger` | `crates/lkjstr-storage/src/commands/repair.rs` | `cache_ledger.upsert` | manifest recoverable tables and `cache_ledger` | `repair_backfill_plan`, `sqlite_cache_ledger_row`, `repair_finding` | `sqlite_store/repair.rs` ledger batch binding | cache maintenance repositories | `cargo test -p lkjstr-storage repair`; `cargo test -p lkjstr-web repair` |
| `repair.report-inventory` | `crates/lkjstr-storage/src/commands/repair.rs` | inventory-only generated counts | manifest tables | `repair_inventory_report`, `repair_finding` | `sqlite_store/repair.rs` health/outcome adapter | cache maintenance repositories | `cargo test -p lkjstr-storage repair`; `cargo test -p lkjstr-web repair` |
| `search.local-query` | add `crates/lkjstr-storage/src/commands/search.rs` | search token query open | search token tables open | token row codecs open | add `sqlite_store/search.rs` | search-index repositories | `cargo test -p lkjstr-storage search` |
| `search.update-event-index` | add `crates/lkjstr-storage/src/commands/search.rs` | token delete and insert open | search token tables open | token row codecs open | add `sqlite_store/search.rs` | search-index repositories | `cargo test -p lkjstr-storage search` |
| `tag-lookup.by-value` | add or extend search metadata | `events.by_tag_value` | `events`, `event_tags` | `event_from_sqlite_row` | `sqlite_store/events.rs` first bridge | event cache and search-index repositories | event cache and search tests |

## Inventory Exception

`storage-inventory.snapshot` is documented in [retention.md](retention.md) as
inventory-only. It uses storage-owned generated count SQL for known SQLite
schema tables instead of repository statement ids. Product code still must not
format table names or open SQLite directly.

## Repair Reporting

Repair reports schema mismatch, corrupt rows, decode failures, incomplete
inventory, temporary memory mode, orphan ledger rows, orphan resource rows,
backfill results, unknown ownership, skipped unknown rows, and chunk
continuation. It never marks unknown rows safe and never deletes protected
account data, signing secrets, settings, relay sets, workspace state, drafts,
active jobs, active tab snapshots, route blocks, or safety configuration.
