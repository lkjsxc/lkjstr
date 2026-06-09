# Storage Source

## Purpose

Storage source files define the executable storage table manifest, SQLite row
codecs, ledger resource map, and typed operation outcomes.

## Table of Contents

- `accounts.rs`: account row identity, JSON helpers, and SQLite row codec.
- `active_account.rs`: protected active-account selector row codec.
- `app_log.rs`: app log row codec.
- `commands/`: typed repository command metadata and command-family specs.
- `data_class.rs`: table data classes and inventory groups.
- `diagnostics.rs`: relay diagnostic row codecs and ledger row helpers.
- `events.rs`: cached event, event tag, relay provenance, and ledger row helpers.
- `feed_cache.rs`: feed cursor, coverage, and scan hint row codecs.
- `feed_cache_ledger.rs`: feed cache ledger row helpers.
- `jobs.rs`: job row codec and ledger row helpers.
- `ledger.rs`: cache ledger resource ownership manifest.
- `lib.rs`: public storage crate exports.
- `local_secrets.rs`: local signing secret row helpers and SQLite row codec.
- `manifest.rs`: table specs and table lookup helpers.
- `notifications.rs`: notification row and ledger helpers.
- `optimizer/`: relay optimizer row codecs, retention, and repair helpers.
- `outcome/`: typed storage operation outcomes.
- `retention/`: pure cache-retention planner, row conversion, and delete intents.
- `pressure.rs`: storage pressure snapshot row codec and stop reasons.
- `repair/`: conservative repair finding, scan, and backfill models.
- `relay_sets.rs`: protected relay-set row identity, JSON helpers, and SQLite row codec.
- `resource.rs`: cache owner and resource kind strings.
- `route_blocks.rs`: protected relay route-block row codec.
- `search.rs`: local Search token rows and tokenizer helpers.
- `settings_defs.rs`: flat settings definition rows.
- `settings.rs`: settings override row identity, JSON helpers, and SQLite row codec.
- `settings_schema.rs`: flat settings schema and override merging.
- `sql/`: executable SQLite schema records for OPFS storage.
- `stats.rs`: storage inventory and pressure view models for Stats.
- `stats_rows.rs`: storage inventory row records.
- `storage_health.rs`: SQLite health view model for Stats.
- `tab_state.rs`: tab-state keys, rows, ledger rows, and SQLite row codecs.
- `table_specs.rs`: table manifest row data.
- `tweet_drafts.rs`: Tweet draft row identity, JSON helpers, and SQLite row codec.
- `workspace.rs`: workspace row identity, JSON size helpers, and SQLite row codec.
