# Storage Retention Repair

## Purpose

Wire retention and repair commands so cache pressure deletes only ledger-backed
prunable rows and reports exact reasons, counts, and repair findings.

## Status

Active. Retention delete dispatch has Rust statement planning and worker-adapter
binding; repair remains next after worker failure proof.

## Current Evidence

- `lkjstr-storage` owns the table manifest, data classes, cache ledger resource
  map, pressure row codecs, retention policy records, pure retention planner,
  and retention command metadata.
- `lkjstr-web` owns retention statement-id planning and binds those statements
  to one SQLite worker batch for delete dispatch.
- TypeScript cache cleanup and compaction paths still own many shipped product
  maintenance actions until Rust product consumption is wired.
- Stats can project real pressure snapshot rows when they exist, but full byte
  inventory diagnostics and repair dispatch remain open.

## Current Next Edit

1. Keep pure retention planning in `lkjstr-storage` and worker dispatch in
   `lkjstr-web`; do not move storage policy into the host adapter.
2. Add focused worker-host failure proof for `sqlite_retention_delete_dispatch`
   when the worker mock can force batch failure.
3. Retain shipped TypeScript cache maintenance until Rust product wiring,
   focused tests, and no-import proof exist.
4. Implement repair scan and backfill only after retention delete semantics are
   proved.

## Next Checklist

- [ ] Read retention deletion, ledger, scoring, dynamic protection, pressure,
  and repair contracts.
- [ ] Update retention and repair command docs before changing source.
- [ ] Preserve the implemented pure Rust planner and `retention.plan` plus
  `retention.delete-dispatch` command metadata.
- [x] Add `crates/lkjstr-web/src/sqlite_store/retention.rs` and export it from
  `crates/lkjstr-web/src/sqlite_store/mod.rs`.
- [x] Map planner delete intents to the statement ids documented in the command
  matrix and delete each resource row with its `cache_ledger` row in one batch.
- [ ] Add conservative repair target states and chunked scan outputs only after
  retention dispatch passes.
- [ ] Run retention, repair, cache-ledger, cache unit, and Rust/WASM gates; then
  record actual verification.

## Target Behavior

Retention selects candidates from `cache_ledger`, skips protected or dynamically
pinned rows, dispatches table-specific deletes through `lkjstr-web`, and reports
candidate count, deleted count, skipped protected count, dynamic-protected skip
count, target bytes, deleted or estimated bytes, and exact stop reason. Repair
reports schema mismatch, corrupt rows, decode failures, incomplete inventory,
temporary memory fallback, orphan rows, skipped unknown rows, chunk continuation,
and backfill results without silently marking unknown rows safe.

## Docs To Update First

- `docs/architecture/data/storage/retention/README.md`.
- `docs/architecture/data/storage/retention/deletion.md`.
- `docs/architecture/data/storage/retention/repair.md`.
- `docs/architecture/data/storage/diagnostics/pressure-states.md`.
- `docs/architecture/rust-wasm/cutover/areas/storage.md`.
- `docs/architecture/rust-wasm/cutover/verification-ledger.md` after checks run.

## Rust Files To Touch

- `crates/lkjstr-storage/src/ledger.rs` only if resource ownership changes.
- `crates/lkjstr-storage/src/resource.rs` only if resource kinds change.
- `crates/lkjstr-storage/src/retention/**` for planner input or output shape.
- `crates/lkjstr-storage/src/commands/retention.rs` for command metadata drift.
- `crates/lkjstr-web/src/retention_dispatch.rs` for dispatch step planning.
- `crates/lkjstr-web/src/retention_routes.rs` for resource-kind routing.
- `crates/lkjstr-web/src/sqlite_store/retention.rs` for worker batch binding.
- `crates/lkjstr-web/src/sqlite_store/mod.rs` to export the adapter.
- `crates/lkjstr-web/src/sqlite_store/cache_ledger.rs` for shared ledger steps.
- `crates/lkjstr-storage/src/repair/**` after retention dispatch is proved.

## Temporary TypeScript Or Svelte Files To Keep

Keep `src/lib/storage/sqlite-opfs/cache-ledger-*.ts`,
`src/lib/storage/sqlite-opfs/cache-compaction-sqlite.ts`, `src/lib/cache/**`,
and shipped Stats/cache surfaces until Rust retention and repair product wiring
have no-import proof.

## Tests To Add Or Update

- Event deletion batches child event rows, the event row, and `cache_ledger`.
- Feed cursor, coverage, scan-hint, diagnostic, route, and job deletes pair the
  resource statement with `cache_ledger.delete`.
- Protected, dynamically protected, and unknown table inputs return typed skip
  or problem states without deleting resources.
- Batch failure maps to a `StorageOutcome` problem and does not claim success.
- Stop reasons distinguish no-prunable-candidates, protected-only,
  unknown-unowned-usage, inventory-incomplete, quota-pressure,
  storage-api-unavailable, and compaction-error.
- Repair reports orphan, corrupt, decode-failure, schema-mismatch, and temporary
  memory fallback states after retention dispatch lands.
- Cache unit tests continue to pass while TypeScript owns shipped maintenance UI.

## Focused Gate

```sh
cargo test -p lkjstr-storage retention
cargo test -p lkjstr-storage repair
cargo test -p lkjstr-web cache_ledger
pnpm test -- tests/unit/cache
pnpm rust-wasm:quiet
```

## Final Gate

Run Docker Compose final verification before retention cutover or deletion
claims.

## Commit Boundary

Use separate commits for retention delete dispatch and repair reporting unless a
shared command shape change requires one commit.

## Must Not

- Do not move retention policy into `lkjstr-web`.
- Do not prune protected records or active jobs.
- Do not delete unknown, unowned, or malformed input rows.
- Do not treat missing ledger ownership as safe.
- Do not hide inventory-incomplete or storage-API-unavailable states.
- Do not delete TypeScript maintenance paths before product parity.
