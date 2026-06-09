# Storage Command Spec Shape

## Purpose

Redesign storage command metadata so live SQLite worker repositories can describe
multi-statement, ledger-backed batches without one-table shortcuts.

## Status

Implemented for the command metadata shape. Retain this file as proof while
remaining command-family coverage stays active.

## Current Evidence

- `crates/lkjstr-storage/src/commands/spec.rs` defines the batch-capable command
  metadata shape and policy enums.
- `crates/lkjstr-storage/src/commands/active_account.rs` and `pressure.rs`
  preserve active selector and pressure specs with statement arrays and table
  arrays.
- `crates/lkjstr-storage/tests/commands_shape_test.rs` proves command ids,
  statement ids, table names, codecs, problem kinds, ledger policy, protection
  policy, and Stats projection invariants for implemented specs.
- Event writes and feed coverage writes already touch resource rows, child rows,
  provenance rows, and `cache_ledger` rows in one batch, but their command-family
  coverage remains open.

## Implemented Behavior

`StorageRepositoryCommandSpec` names command id, family, operation, input type,
output type, statement ids, table names, row codecs, problem kinds, data
classes, ledger policy, protection policy, and Stats projection. Metadata stays
as explicit compile-time arrays with no macro layer.

## Docs To Update First

- `docs/execution/tasks/storage-command-metadata.md`.
- `docs/architecture/data/sqlite-opfs/repositories.md`.
- `docs/architecture/rust-wasm/cutover/storage-wiring.md`.
- `docs/architecture/rust-wasm/cutover/areas/storage.md`.
- `docs/architecture/rust-wasm/cutover/verification-ledger.md` after checks run.

## Rust Files To Touch

- `crates/lkjstr-storage/src/commands/mod.rs`.
- `crates/lkjstr-storage/src/commands/spec.rs`.
- `crates/lkjstr-storage/src/commands/active_account.rs`.
- `crates/lkjstr-storage/src/commands/pressure.rs`.
- `crates/lkjstr-storage/src/lib.rs` for preserved exports.
- `crates/lkjstr-storage/tests/commands_shape_test.rs`.

## Temporary TypeScript Or Svelte Files To Keep

Keep all TypeScript SQLite repositories and Svelte product paths. Metadata is
not product parity and does not permit deletion.

## Tests To Add Or Update

- Every command id is unique.
- Every command has at least one statement id.
- Every statement id exists in `sqlite_repository_statements()`.
- Every command table exists in the manifest unless the command is inventory-only.
- Every row codec label is non-empty and family-appropriate.
- Ledger-backed writes declare a same-batch ledger policy.
- Protected commands declare protected policy and are never prunable.
- Stats projections map to documented Stats rows.

## Focused Gate

```sh
cargo fmt --check
cargo test -p lkjstr-storage commands
cargo run -p lkjstr-xtask -- check-storage-manifest-docs
cargo run -p lkjstr-xtask -- check-rust-style
```

## Final Gate

Run Docker Compose final verification before broad storage parity or deletion
claims.

## Commit Boundary

Keep this implemented shape separate from broad command-family coverage when
possible. Follow-up commits should add one live command-family group at a time.

## Must Not

- Do not invent command specs for repositories that do not exist.
- Do not add procedural macros or async traits for static metadata.
- Do not claim storage cutover parity from metadata alone.
- Do not delete TypeScript or Svelte product paths.
