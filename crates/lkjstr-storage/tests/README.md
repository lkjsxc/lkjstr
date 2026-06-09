# Storage Tests

## Purpose

Storage tests keep Rust contracts aligned with the documented and current
browser storage manifest.

## Table of Contents

- `commands_test.rs`: typed repository command specs.
- `ledger_test.rs`: cache resource ownership manifest behavior.
- `manifest_docs_test.rs`: docs table metadata compared with Rust manifest.
- `manifest_test.rs`: table manifest names, retention, and grouping.
- `outcome_test.rs`: storage problem and outcome constructors.
- `protected_sqlite_rows_test.rs`: SQLite protected row codecs.
- `pressure_test.rs`: pressure snapshot codec and stop reasons.
- `relay_sets_test.rs`: protected relay-set row serialization.
- `stats_test.rs`: Stats inventory, health, and pressure projection.
- `tab_state_test.rs`: tab-state key and ledger record behavior.
- `tweet_drafts_test.rs`: protected Tweet draft row serialization.
- `workspace_test.rs`: workspace row JSON and identity behavior.
