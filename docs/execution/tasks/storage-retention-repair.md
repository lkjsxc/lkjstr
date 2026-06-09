# Storage Retention Repair

## Purpose

Wire retention and repair commands so cache pressure deletes only ledger-backed
prunable rows and reports exact reasons, counts, and repair findings.

## Status

Active after command spec shape and cache command metadata are in place.

## Current Evidence

- `lkjstr-storage` owns the table manifest, data classes, cache ledger resource
  map, pressure row codecs, and retention policy records.
- TypeScript cache cleanup and compaction paths still own many shipped product
  maintenance actions.
- Stats can project real pressure snapshot rows when they exist, but full byte
  inventory diagnostics and repair dispatch remain open.

## Current Next Edit

1. Add pure retention planning before delete-dispatch worker wiring.
2. Add retention command metadata only for real planner and dispatcher paths.
3. Implement repair scan and backfill only after retention semantics are proved.

## Next Checklist

- [ ] Read retention deletion, ledger, scoring, dynamic protection, pressure,
  and repair contracts.
- [ ] Update retention and repair command docs before changing source.
- [ ] Add a pure Rust retention planner with deterministic candidate ordering
  and exact stop reasons.
- [ ] Add command metadata for `retention.plan` and
  `retention.delete-dispatch` only when real dispatch exists.
- [ ] Add conservative repair target states and chunked scan outputs.
- [ ] Run retention, repair, cache-ledger, cache unit, and Rust/WASM gates; then
  record actual verification.

## Target Behavior

Retention selects candidates from `cache_ledger`, skips protected or dynamically
pinned rows, dispatches table-specific deletes, and reports candidate count,
deleted count, skipped protected count, and stop reason. Repair reports schema
mismatch, corrupt rows, decode failures, incomplete inventory, temporary memory
fallback, orphan rows, and backfill results without silently marking unknown rows
safe.

## Docs To Update First

- `docs/architecture/data/storage/retention/README.md`.
- `docs/architecture/data/storage/retention/deletion.md`.
- `docs/architecture/data/storage/retention/repair.md`.
- `docs/architecture/data/storage/diagnostics/pressure-states.md`.
- `docs/architecture/rust-wasm/cutover/areas/storage.md`.
- `docs/architecture/rust-wasm/cutover/verification-ledger.md` after checks run.

## Rust Files To Touch

- `crates/lkjstr-storage/src/ledger.rs`.
- `crates/lkjstr-storage/src/resource.rs`.
- `crates/lkjstr-storage/src/retention.rs` when present.
- `crates/lkjstr-storage/src/repair.rs` when present.
- `crates/lkjstr-storage/src/commands/retention.rs`.
- `crates/lkjstr-web/src/sqlite_store/cache_ledger.rs`.

## Temporary TypeScript Or Svelte Files To Keep

Keep `src/lib/storage/sqlite-opfs/cache-ledger-*.ts`,
`src/lib/storage/sqlite-opfs/cache-compaction-sqlite.ts`, `src/lib/cache/**`,
and shipped Stats/cache surfaces until Rust retention and repair product wiring
have no-import proof.

## Tests To Add Or Update

- Protected rows are never selected or deleted.
- Ledger-backed prunable rows are deleted by table-specific dispatchers.
- Stop reasons distinguish no-prunable-candidates, protected-only,
  unknown-unowned-usage, inventory-incomplete, quota-pressure,
  storage-api-unavailable, and compaction-error.
- Repair reports orphan, corrupt, decode-failure, schema-mismatch, and temporary
  memory fallback states.
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

- Do not prune protected records.
- Do not treat missing ledger ownership as safe.
- Do not hide inventory-incomplete or storage-API-unavailable states.
- Do not delete TypeScript maintenance paths before product parity.
