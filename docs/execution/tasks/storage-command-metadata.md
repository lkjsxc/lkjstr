# Storage Command Metadata

## Purpose

Expand typed storage command metadata for every live Rust SQLite worker
repository call after `storage-command-spec-shape.md` makes the spec truthful for
multi-statement batches.

## Status

Active. This task follows the command-shape split and groups coverage by live
repository family.

## Current Evidence

- Active-account selector and pressure commands have typed specs.
- Many `lkjstr-web/src/sqlite_store/**` exports exist without matching command
  metadata.
- Event and feed writes need batch metadata because one command may touch
  resource rows, child rows, provenance rows, and `cache_ledger` rows.

## Target Behavior

Each live command names its id, family, operation kind, input type, output type,
statement ids, tables, row codecs, stable problem kinds, data classes, ledger
policy, protection policy, and Stats projection when any. Read commands with row
codecs declare decode problem kinds. Ledger-backed writes declare same-batch
ledger policy. Protected commands are protected and never prunable.

## Files To Read

- `docs/execution/tasks/storage-command-spec-shape.md`.
- `docs/architecture/data/sqlite-opfs/repositories.md`.
- `docs/architecture/rust-wasm/cutover/storage-wiring.md`.
- `crates/lkjstr-storage/src/commands/**`.
- `crates/lkjstr-storage/src/sql.rs`.
- `crates/lkjstr-web/src/sqlite_store/**`.

## Docs To Update First

- Storage command matrix under storage docs when command families change.
- `docs/architecture/rust-wasm/cutover/areas/storage.md`.
- `docs/architecture/rust-wasm/cutover/storage-wiring.md`.
- `docs/architecture/rust-wasm/cutover/verification-ledger.md` after checks run.

## Rust Files To Touch

- `crates/lkjstr-storage/src/commands/**`.
- `crates/lkjstr-storage/src/lib.rs` when public exports move.
- Command metadata tests under `crates/lkjstr-storage/tests/`.

## Temporary TypeScript Or Svelte Files To Keep

Keep TypeScript storage repositories until Rust command coverage, product
wiring, focused tests, and no-import proof are complete.

## Tests To Add Or Update

- Unique command ids.
- Missing statement detection.
- Manifest table detection except for documented inventory-only commands.
- Missing or family-wrong row-codec label detection.
- Stable problem-kind detection for reads and writes.
- Ledger policy detection for ledger-backed writes.
- Protected policy detection for protected rows.
- Stats projection mapping for documented Stats rows.

## Focused Gate

```sh
cargo test -p lkjstr-storage commands
cargo run -p lkjstr-xtask -- check-storage-manifest-docs
cargo run -p lkjstr-xtask -- check-rust-style
```

## Final Gate

Run Docker Compose final gate before broad storage parity claims.

## Commit Boundary

One command-family group per commit unless tests require a shared split.

## Must Not

- Do not invent command specs for non-existent repositories.
- Do not mark storage cutover complete from metadata alone.
- Do not delete TypeScript or Svelte product paths.
