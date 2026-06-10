# Storage Command Metadata

## Purpose

Expand typed storage command metadata for every live Rust SQLite worker
repository call after `storage-command-spec-shape.md` makes the spec truthful for
multi-statement batches.

## Status

Active. This task follows the command-shape split and groups coverage by live
repository family in this order: protected, event cache, feed evidence,
diagnostics, jobs, app log, optimizer, retention, repair, Search query adapter,
and pressure inventory.

## Current Evidence

- Active-account selector, pressure, protected rows, event cache, feed
  evidence, diagnostics, notifications, jobs, app log, inventory snapshot, and
  optimizer scan-model rows have typed specs.
- Retention planner and delete-dispatch metadata are implemented, and
  `lkjstr-web` binds delete-dispatch statement plans to one worker batch.
- Repair scan, backfill, and inventory report command metadata are implemented
  with conservative storage-owned models and basic `lkjstr-web` worker outcome
  adapters. Physical target probes are implemented. Search token rows, tag
  lookup metadata, update-event-index metadata, local-query metadata, and
  local-query adapter wiring are implemented.
- Event and feed writes use batch metadata because one command may touch
  resource rows, child rows, provenance rows, and `cache_ledger` rows.

## Next Edit

1. Preserve retention, repair, and Search command specs with real statement ids,
   manifest tables, codecs, problem kinds, ledger policy, protection policy,
   and Stats projection when any.
2. Keep repair physical target probes storage-routed and host-executed only by
   approved statement ids.
3. Keep app-level Search planning, NIP-50 merge, and UI parity out of storage
   command metadata.

## Next Checklist

- [ ] Read retention deletion, ledger, scoring, dynamic protection, pressure,
      and command matrix contracts.
- [ ] Update command matrix docs before changing Rust command metadata.
- [x] Add retention planner and command specs with real statements, tables, row
      codecs, problem kinds, data classes, delete condition, and policies.
- [x] Register retention specs in `storage_repository_commands()`.
- [x] Add retention-focused command tests and docs-coverage assertions.
- [x] Register repair scan, backfill, and inventory report specs with focused
      storage command tests.
- [x] Add repair worker outcome adapter tests without moving safety policy out
      of storage.
- [x] Register Search token/tag command specs and indexed token row codecs with
      focused storage tests.
- [x] Add repair physical target probe command metadata and adapter proof.
- [ ] Run the storage command focused gate and update verification evidence with
      actual commands.

## Acceptance

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

## Files To Touch

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
