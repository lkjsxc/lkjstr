# Retention Source

## Purpose

This module owns pure cache-retention planning for ledger-backed resources.

## File Map

- `mod.rs`: public exports.
- `model.rs`: input, output, stop reason, and delete intent data.
- `plan.rs`: deterministic pure planner and candidate filtering.
- `row.rs`: SQLite cache-ledger row to planner candidate conversion.

## Rule

The module has no browser effects and no SQL execution. Worker dispatch stays in
`lkjstr-web`.
