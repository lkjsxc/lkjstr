# Storage Stats Pressure Inventory

## Purpose

Complete storage pressure and inventory diagnostics so Stats reports real storage
health, byte classes, old-store presence, and exact unavailable states.

## Status

Active after command metadata shape preserves pressure rows and inventory-only
commands.

## Current Evidence

- Rust pressure snapshot row codecs and worker calls exist.
- Rust Stats can project protected bytes, prunable bytes, unknown storage,
  residual overhead, and stop reason from a real pressure snapshot row.
- Full physical byte inventory, old IndexedDB presence diagnostics, and repair
  linkage remain open.

## Current Next Edit

1. Keep pressure and optimizer command metadata intact while retention lands.
2. Link full inventory work to retention and repair outputs instead of inventing
   standalone byte safety.
3. Add UI projection changes only after storage rows expose real unavailable
   states.

## Next Checklist

- [ ] Read inventory, pressure-state, Stats, and storage-pressure verification
  contracts.
- [ ] Update docs for any new pressure state or inventory field before source.
- [ ] Add storage-owned inventory rows or projections for missing physical byte
  classes.
- [ ] Add Stats projections for every unavailable mode and pressure stop reason.
- [ ] Add Rust UI tests for explicit unavailable states when view fields change.
- [ ] Run pressure, stats, commands, UI stats, and Rust/WASM gates; then record
  actual verification.

## Target Behavior

Stats shows persistent OPFS, temporary memory, unavailable, timeout, blocked,
corrupt, or unknown-old-storage without indefinite loading. Inventory separates
protected bytes, prunable bytes, unknown storage, residual browser overhead,
localStorage, Cache Storage, SQLite table counts, cache ledger summaries, and
old IndexedDB presence diagnostics. Missing pressure data renders an explicit
unavailable reason.

## Docs To Update First

- `docs/architecture/data/storage/diagnostics/inventory.md`.
- `docs/architecture/data/storage/diagnostics/pressure-states.md`.
- `docs/architecture/data/storage/diagnostics/stats.md`.
- `docs/operations/storage-pressure-verification.md`.
- `docs/architecture/rust-wasm/cutover/areas/storage.md`.
- `docs/architecture/rust-wasm/cutover/verification-ledger.md` after checks run.

## Rust Files To Touch

- `crates/lkjstr-storage/src/pressure.rs`.
- `crates/lkjstr-storage/src/stats.rs`.
- `crates/lkjstr-storage/src/commands/pressure.rs`.
- `crates/lkjstr-storage/src/commands/diagnostics.rs`.
- `crates/lkjstr-web/src/sqlite_store/pressure.rs`.
- `crates/lkjstr-ui/src/workspace/stats*.rs` when view fields change.

## Temporary TypeScript Or Svelte Files To Keep

Keep TypeScript Stats, storage pressure, cache inventory, and old-store
presence helpers until Rust Stats parity and no-import proof exist.

## Tests To Add Or Update

- Pressure snapshot decode and unavailable-state projection.
- Inventory-only commands are exempt from manifest table assertions only when
  documented as inventory-only.
- Stats distinguishes no-prunable-candidates, protected-only,
  unknown-unowned-usage, inventory-incomplete, quota-pressure,
  storage-api-unavailable, and compaction-error.
- Old IndexedDB diagnostics report presence only and do not scan old rows.
- Rust UI renders explicit unavailable states instead of indefinite loading.

## Focused Gate

```sh
cargo test -p lkjstr-storage pressure
cargo test -p lkjstr-storage stats
cargo test -p lkjstr-storage commands
cargo test -p lkjstr-ui stats
pnpm rust-wasm:quiet
```

## Final Gate

Run Docker Compose final verification before broad Stats or storage parity
claims.

## Commit Boundary

Keep pressure row metadata, physical inventory projection, and UI presentation in
separate commits unless a shared view-model field requires one commit.

## Must Not

- Do not show endless loading when storage mode or pressure data is unavailable.
- Do not scan old IndexedDB rows for inventory.
- Do not merge protected, prunable, unknown, and overhead bytes into one number.
- Do not claim Stats parity until relay, optimizer, jobs, memory, and log rows
  also meet their proof requirements.
