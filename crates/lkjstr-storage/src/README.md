# Storage Source

## Purpose

Storage source files define the executable storage table manifest, ledger
resource map, and typed operation outcomes.

## Table of Contents

- `accounts.rs`: account row identity and JSON helpers.
- `data_class.rs`: table data classes and inventory groups.
- `ledger.rs`: cache ledger resource ownership manifest.
- `lib.rs`: public storage crate exports.
- `local_secrets.rs`: local signing secret row helpers.
- `manifest.rs`: table specs and table lookup helpers.
- `outcome.rs`: typed storage operation outcomes.
- `resource.rs`: cache owner and resource kind strings.
- `settings_defs.rs`: flat settings definition rows.
- `settings.rs`: settings override row identity and JSON helpers.
- `settings_schema.rs`: flat settings schema and override merging.
- `stats.rs`: storage inventory view models for Stats.
- `tab_state.rs`: tab-state keys, rows, and ledger rows.
- `table_specs.rs`: table manifest row data.
- `workspace.rs`: workspace row identity and JSON size helpers.
