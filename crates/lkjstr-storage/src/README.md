# Storage Source

## Purpose

Storage source files define the executable storage table manifest, SQLite row
codecs, ledger resource map, and typed operation outcomes.

## Table of Contents

- `accounts.rs`: account row identity, JSON helpers, and SQLite row codec.
- `data_class.rs`: table data classes and inventory groups.
- `ledger.rs`: cache ledger resource ownership manifest.
- `lib.rs`: public storage crate exports.
- `local_secrets.rs`: local signing secret row helpers and SQLite row codec.
- `manifest.rs`: table specs and table lookup helpers.
- `outcome.rs`: typed storage operation outcomes.
- `relay_sets.rs`: protected relay-set row identity, JSON helpers, and SQLite row codec.
- `resource.rs`: cache owner and resource kind strings.
- `settings_defs.rs`: flat settings definition rows.
- `settings.rs`: settings override row identity, JSON helpers, and SQLite row codec.
- `settings_schema.rs`: flat settings schema and override merging.
- `sql/`: executable SQLite schema records for OPFS storage.
- `stats.rs`: storage inventory view models for Stats.
- `tab_state.rs`: tab-state keys, rows, ledger rows, and SQLite row codecs.
- `table_specs.rs`: table manifest row data.
- `workspace.rs`: workspace row identity, JSON size helpers, and SQLite row codec.
