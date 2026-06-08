# Storage Execution Slice

## Purpose

This file turns the storage blockers into the next executable slice. Status:
implemented as workflow; Rust storage behavior is partial until the linked
cutover rows and tests pass.

## Summary

The current storage slice wires Rust typed repositories for active-account
selectors, pressure diagnostics, feed cache, feed coverage, retention dispatch,
repair, and Stats projection. Active-account selectors use a protected settings
row. It must not delete TypeScript storage repositories until Rust covers every
live table family and no-import proof is recorded.

## Read First

- [../current-state.md](../current-state.md).
- [../architecture/data/storage/README.md](../architecture/data/storage/README.md).
- [../architecture/data/sqlite-opfs/README.md](../architecture/data/sqlite-opfs/README.md).
- [../architecture/data/sqlite-opfs/repositories.md](../architecture/data/sqlite-opfs/repositories.md).
- [../architecture/rust-wasm/storage-kernel.md](../architecture/rust-wasm/storage-kernel.md).
- [../architecture/rust-wasm/cutover/storage-wiring.md](../architecture/rust-wasm/cutover/storage-wiring.md).
- [../architecture/rust-wasm/cutover/areas/storage.md](../architecture/rust-wasm/cutover/areas/storage.md).

## Implementation Targets

- `crates/lkjstr-storage/`: manifest records, row codecs, operation outcomes,
  repository command types, retention, repair, and diagnostics.
- `crates/lkjstr-web/src/sqlite_store/`: typed worker adapter calls and outcome
  mapping for storage commands.
- `crates/lkjstr-app/`: product composition that consumes typed repositories.
- `crates/lkjstr-ui/`: Stats and protected tool view models when fields change.
- `src/lib/storage/sqlite-opfs/` and `src/lib/storage/repositories/`: shipped
  TypeScript worker glue retained until Rust parity and no-import proof exist.

## Required Work

1. Inventory live SQLite table families from storage docs and current worker
   repositories.
2. Add or verify Rust row codecs for protected rows, event rows, tags, relay
   provenance, feed coverage, feed cursors, cache ledger rows, diagnostics,
   optimizer rows, job rows, log rows, active-account selectors, and pressure
   snapshots.
3. Add typed command definitions with input type, output type, stable problem
   kind, row codec, and real-shaped fixtures.
4. Wire `lkjstr-web` worker calls without adding main-thread SQLite or OPFS
   access.
5. Expose persistent OPFS, temporary memory, unavailable, timeout, blocked,
   corrupt, and unknown-old-storage health states.
6. Report protected bytes, prunable bytes, unknown storage, residual browser
   overhead, and exact pressure stop reasons.
7. Add retention and repair commands that never prune protected rows and always
   report reasons and counts.

## Focused Gates

```sh
cargo test -p lkjstr-storage
cargo test -p lkjstr-web
pnpm test -- tests/unit/cache tests/unit/events/repository.test.ts
pnpm test -- tests/unit/feed-surface/scan-model-repository.test.ts
pnpm rust-wasm:quiet
```

## Acceptance

- Active-account selectors and pressure snapshots have Rust row codecs and
  worker repository calls.
- Product modules call typed repositories only.
- Main-thread product code does not open SQLite or OPFS directly.
- Stats shows storage health and mode without indefinite loading.
- Temporary memory mode is explicit.
- Pressure stop reason is exact.
- Protected data is never pruned.
- Rust row codecs and operation outcomes cover every touched table.
- Parity and deletion ledgers stay aligned with the actual status.
