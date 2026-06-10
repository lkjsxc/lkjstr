# Skill: Storage Kernel

## Purpose

Change the worker-owned SQLite OPFS storage kernel: table manifest, row
codecs, typed repository commands, retention, repair, pressure, inventory,
search rows, active selectors, and Stats storage projections.

## Trigger

The change touches `crates/lkjstr-storage`,
`crates/lkjstr-web/src/sqlite_store/`, `src/lib/storage/`, or a storage
contract under `docs/architecture/data/`.

## Read First

- [../../execution/storage-slice.md](../../execution/storage-slice.md).
- [../../architecture/data/storage/README.md](../../architecture/data/storage/README.md).
- [../../architecture/data/sqlite-opfs/README.md](../../architecture/data/sqlite-opfs/README.md).
- [../../architecture/data/sqlite-opfs/repositories.md](../../architecture/data/sqlite-opfs/repositories.md).
- [../../architecture/rust-wasm/storage-kernel.md](../../architecture/rust-wasm/storage-kernel.md).
- [../../architecture/rust-wasm/cutover/storage-wiring.md](../../architecture/rust-wasm/cutover/storage-wiring.md).

## Files Likely Touched

- `crates/lkjstr-storage/`: manifest, command metadata, row codecs, outcomes,
  retention, repair, diagnostics.
- `crates/lkjstr-web/src/sqlite_store/`: typed worker adapter calls.
- `src/lib/storage/sqlite-opfs/` and `src/lib/storage/repositories/`: shipped
  TypeScript glue retained until deletion proof.
- Storage docs and the table manifest doc when tables or commands change.

## Procedure

1. Update the storage contract and table manifest docs before source.
2. Keep policy in `lkjstr-storage` and worker dispatch in `lkjstr-web`; never
   move safety policy into the host adapter.
3. Add row codecs, stable problem kinds, and command metadata for every
   touched table family.
4. Expose health truthfully: persistent OPFS, temporary memory, unavailable,
   timeout, blocked, corrupt, and unknown-old-storage states stay explicit.
5. Keep Stats projections backed by real rows or an explicit unavailable
   reason.

## Focused Gate

```sh
cargo test -p lkjstr-storage
cargo test -p lkjstr-web
pnpm test -- tests/unit/cache tests/unit/events/repository.test.ts
pnpm test -- tests/unit/feed-surface/scan-model-repository.test.ts
cargo run -p lkjstr-xtask -- check-storage-manifest-docs
pnpm rust-wasm:quiet
```

## Final Gate

Run the Docker final gate before storage cutover or deletion claims;
otherwise record it as not run.

## Must Not

- Do not prune protected records: accounts, local signing secrets, settings,
  relay sets, workspace state, Tweet drafts, active tab snapshots, active
  jobs, route blocks.
- Do not add main-thread SQLite or OPFS access, or raw SQL in product code.
- Do not treat unknown or unowned rows as safe to delete.
- Do not hide inventory-incomplete or storage-API-unavailable states.
- Do not delete TypeScript storage repositories before
  [deletion-proof.md](deletion-proof.md) passes for them.

## Handoff

Name the table families and command specs that changed, and the exact storage
proof gaps that remain open in the blocker row.
