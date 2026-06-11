# Storage Execution Slice

## Purpose

This file turns the storage blockers into the next executable slice. Status:
implemented as workflow; Rust storage behavior is partial until the linked
cutover rows and tests pass.

## Summary

The current storage slice preserves implemented active-account selector,
pressure-row, protected, event-cache, feed-evidence, diagnostics,
notifications, jobs, app-log, inventory, optimizer, retention planning,
retention delete dispatch, local Search query adapters, and batch-capable
command-shape contracts. Repair physical probes are implemented; full physical
pressure inventory and retention product consumption remain open. It must not
delete TypeScript storage repositories
until Rust covers every live table family and no-import proof is recorded.

## Agent Start

- Current source owner: TypeScript SQLite worker repositories for shipped
  product storage plus partial Rust storage worker adapters.
- Desired Rust owner: `lkjstr-storage` for policy and rows, `lkjstr-web` for
  worker calls, `lkjstr-app` for product use, and `lkjstr-ui` for Stats views.
- Next source edit: retention and repair product consumption through the
  storage-owned inventory readiness signal.
- Focused tests: pressure, Stats, command, UI Stats, retention, repair, web
  retention, cache unit tests, and `pnpm rust-wasm:quiet` as the touched files
  require.
- Ledgers: storage cutover area, implementation ledger rows that gain behavior,
  and verification ledger after actual checks.
- Keep: all TypeScript storage repositories and Svelte product surfaces until
  Rust parity and no-import proof are recorded.

## Read First

- [../current-state.md](../current-state.md).
- [../architecture/data/storage/README.md](../architecture/data/storage/README.md).
- [../architecture/data/sqlite-opfs/README.md](../architecture/data/sqlite-opfs/README.md).
- [../architecture/data/sqlite-opfs/repositories.md](../architecture/data/sqlite-opfs/repositories.md).
- [../architecture/rust-wasm/storage-kernel.md](../architecture/rust-wasm/storage-kernel.md).
- [../architecture/rust-wasm/cutover/storage-wiring.md](../architecture/rust-wasm/cutover/storage-wiring.md).
- [../architecture/rust-wasm/cutover/areas/storage.md](../architecture/rust-wasm/cutover/areas/storage.md).

## Implementation Targets

- `crates/lkjstr-storage/`: manifest records, command-family metadata, row
  codecs, operation outcomes, repository command types, retention, repair, and
  diagnostics.
- `crates/lkjstr-web/src/sqlite_store/`: typed worker adapter calls and outcome
  mapping for storage commands.
- `crates/lkjstr-app/`: product composition that consumes typed repositories.
- `crates/lkjstr-ui/`: Stats and protected tool view models when fields change.
- `src/lib/storage/sqlite-opfs/` and `src/lib/storage/repositories/`: shipped
  TypeScript worker glue retained until Rust parity and no-import proof exist.

## Required Work

1. Inventory live SQLite table families from storage docs and current worker
   repositories.
2. Preserve Rust row codecs for protected rows, event rows, tags, relay
   provenance, feed coverage, feed cursors, cache ledger rows, diagnostics,
   optimizer rows, job rows, log rows, active-account selectors, and pressure
   snapshots.
3. Preserve retention, repair, Search, pressure, and inventory command
   definitions, then close proof gaps with input type, output type, statement
   ids, tables or documented inventory-only status, stable problem kinds, row
   codecs, data classes, ledger policy, protection policy, Stats projection,
   and real-shaped fixtures.
4. Wire remaining `lkjstr-web` worker calls without adding main-thread SQLite or
   OPFS access.
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

- Active-account selector, pressure snapshot, and batch command-shape contracts
  remain preserved.
- Repair and inventory worker gaps gain truthful command specs while retention
  delete dispatch and local Search query stay covered by Rust adapter tests.
- Product modules call typed repositories only.
- Main-thread product code does not open SQLite or OPFS directly.
- Stats shows storage health, mode, and real pressure snapshot fields without
  indefinite loading.
- Temporary memory mode is explicit.
- Pressure stop reason is exact.
- Protected data is never pruned.
- Rust row codecs and operation outcomes cover every touched table.
- Parity and deletion ledgers stay aligned with the actual status.
