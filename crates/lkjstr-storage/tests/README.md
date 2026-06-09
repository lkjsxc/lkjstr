# Storage Tests

## Purpose

Storage tests keep Rust contracts aligned with the documented and current
browser storage manifest.

## Table of Contents

- `accounts_test.rs`: account row and key behavior.
- `active_account_test.rs`: active selector row behavior.
- `commands_shape_test.rs`: shared repository command metadata invariants.
- `commands_protected_test.rs`: protected and active selector command specs.
- `commands_diagnostics_test.rs`: diagnostics and pressure command specs.
- `commands_event_cache_test.rs`: event-cache command specs.
- `commands_feed_cache_test.rs`: feed-evidence command specs.
- `commands_metadata_coverage_test.rs`: cross-family command coverage invariants.
- `commands_optimizer_test.rs`: optimizer command specs.
- `commands_search_test.rs`: Search command specs.
- `commands_retention_test.rs`: retention command specs.
- `commands_repair_test.rs`: repair command specs.
- `diagnostic_sql_statements_test.rs`: diagnostics statement records.
- `diagnostics_sqlite_rows_test.rs`: diagnostics row codecs.
- `event_cache_sqlite_rows_test.rs`: event-cache row codecs.
- `feed_cache_sqlite_rows_test.rs`: feed-evidence row codecs.
- `ledger_test.rs`: cache resource ownership manifest behavior.
- `manifest_docs_test.rs`: docs table metadata compared with Rust manifest.
- `manifest_test.rs`: table manifest names, retention, and grouping.
- `notifications_sqlite_rows_test.rs`: notification row codecs.
- `outcome_test.rs`: storage problem and outcome constructors.
- `pressure_test.rs`: pressure snapshot codec and stop reasons.
- `protected_sqlite_rows_test.rs`: SQLite protected row codecs.
- `relay_sets_test.rs`: protected relay-set row serialization.
- `repair_probe_test.rs`: repair physical target probe routes.
- `repair_test.rs`: conservative repair scan and backfill behavior.
- `retention_test.rs`: pure retention planner behavior.
- `search_test.rs`: Search tokenization and indexed result behavior.
- `settings_schema_test.rs`: settings schema defaults.
- `settings_test.rs`: setting row behavior.
- `sql_schema_test.rs`: SQLite schema and statement records.
- `stats_byte_rows_test.rs`: Stats pressure byte-summary projection.
- `stats_test.rs`: Stats inventory, health, and pressure projection.
- `tab_state_test.rs`: tab-state key and ledger record behavior.
- `tweet_drafts_test.rs`: protected Tweet draft row serialization.
- `workspace_test.rs`: workspace row JSON and identity behavior.
