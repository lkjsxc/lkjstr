# Storage Command Metadata

## Purpose

Expand typed storage command metadata for every live Rust SQLite worker
repository call after `storage-command-spec-shape.md` makes the spec truthful for
multi-statement batches.

## Status

Active. This task follows the command-shape split and groups coverage by live
repository family in this order: protected, event cache, feed evidence,
diagnostics, jobs, app log, optimizer, retention, repair, search/tag lookup,
and pressure inventory.

## Current Evidence

- Active-account selector, pressure, protected rows, event cache, feed
  evidence, diagnostics, notifications, jobs, app log, inventory snapshot, and
  optimizer scan-model rows have typed specs.
- Retention, repair, and search/tag lookup command coverage are not implemented.
- Event and feed writes use batch metadata because one command may touch
  resource rows, child rows, provenance rows, and `cache_ledger` rows.

## Current Next Edit

1. Implement retention planning and delete-dispatch command coverage.
2. Add tests proving command ids, statements, tables, row codecs, problem kinds,
   ledger policy, protection policy, and Stats projection.
3. Only after retention metadata passes, implement conservative repair commands.

## Next Checklist

- [ ] Read retention deletion, ledger, scoring, dynamic protection, pressure,
  and command matrix contracts.
- [ ] Update command matrix docs before changing Rust command metadata.
- [ ] Add retention planner and command specs with real statements, tables, row
  codecs, problem kinds, and policies.
- [ ] Register retention specs in `storage_repository_commands()`.
- [ ] Add retention-focused command tests and docs-coverage assertions.
- [ ] Run the storage command focused gate and update verification evidence with
  actual commands.

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

- Storage command matrix under
  `docs/architecture/data/storage/kernel/commands/` when command families
  change.
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
