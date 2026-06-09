# Storage Command Metadata

## Purpose

Expand `StorageRepositoryCommandSpec` so every live Rust SQLite worker
repository call has typed command metadata before storage cutover claims grow.

## Current Evidence

- Active-account selector and pressure commands have specs.
- Many `lkjstr-web/src/sqlite_store/**` exports exist without matching command
  metadata.

## Target Behavior

Each live command names its id, table or statement family, row codec, input,
output, operation kind, stable problem kind, protection and pruning status,
ledger resource kind, Stats projection when any, and focused tests.

## Files To Read

- `docs/architecture/data/sqlite-opfs/repositories.md`.
- `docs/architecture/rust-wasm/cutover/storage-wiring.md`.
- `crates/lkjstr-storage/src/commands.rs`.
- `crates/lkjstr-web/src/sqlite_store/**`.

## Docs To Update First

- Storage command matrix under storage docs.
- `docs/architecture/rust-wasm/cutover/areas/storage.md`.
- `docs/architecture/rust-wasm/cutover/verification-ledger.md`.

## Rust Files To Touch

- `crates/lkjstr-storage/src/commands.rs` or a split `commands/` module.
- Command metadata tests under `crates/lkjstr-storage/tests/`.

## Temporary TypeScript Or Svelte Files To Keep

Keep TypeScript storage repositories until Rust command coverage, product
wiring, and no-import proof are complete.

## Tests To Add Or Update

- Missing table detection.
- Missing row-codec label detection.
- Unknown problem-kind detection.

## Focused Gate

```sh
cargo test -p lkjstr-storage commands
cargo run -p lkjstr-xtask -- check-storage-manifest-docs
```

## Final Gate

Run Docker Compose final gate before broad storage parity claims.

## Commit Boundary

One command-family group per commit unless tests require a shared split.

## Must Not

- Do not invent command specs for non-existent repositories.
- Do not mark storage cutover complete from metadata alone.
