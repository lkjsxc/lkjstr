# Storage Source

## Purpose

Storage source files define the executable storage table manifest, SQLite row
codecs, ledger resource map, and typed operation outcomes.

## Table of Contents

- `accounts.rs`: account row identity, JSON helpers, and SQLite row codec.
- `active_account.rs`: protected active-account selector row codec.
- `app_log.rs`: app log row codec.
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
- `outcome.rs`: typed storage operation outcomes.
- `pressure.rs`: storage pressure snapshot row codec and stop reasons.
- `relay_sets.rs`: protected relay-set row identity, JSON helpers, and SQLite row codec.
- `resource.rs`: cache owner and resource kind strings.
- `route_blocks.rs`: protected relay route-block row codec.
- `settings_defs.rs`: flat settings definition rows.
- `settings.rs`: settings override row identity, JSON helpers, and SQLite row codec.
- `settings_schema.rs`: flat settings schema and override merging.
- `sql/`: executable SQLite schema records for OPFS storage.
- `stats.rs`: storage inventory and SQLite health view models for Stats.
- `tab_state.rs`: tab-state keys, rows, ledger rows, and SQLite row codecs.
- `table_specs.rs`: table manifest row data.
- `workspace.rs`: workspace row identity, JSON size helpers, and SQLite row codec.
