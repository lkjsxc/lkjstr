# Storage Wiring Cutover

## Purpose

This contract maps every live storage family from TypeScript SQLite worker code
to the Rust storage manifest, Rust row codecs, worker messages, tests, and the
condition that allows TypeScript product storage deletion.

## Agent Start

- Current source owner: shipped TypeScript SQLite worker repositories, with Rust
  worker calls already present for protected rows, cache evidence, diagnostics,
  optimizer rows, pressure rows, inventory, and app log.
- Desired Rust owner: storage command specs in `lkjstr-storage`, worker effects
  in `lkjstr-web`, and product consumption in `lkjstr-app` and `lkjstr-ui`.
- Next source edit: retention and repair product consumption through the
  storage-owned inventory readiness signal.
- Focused tests: `cargo test -p lkjstr-storage pressure`,
  `cargo test -p lkjstr-storage stats`, `cargo test -p lkjstr-storage commands`,
  `cargo test -p lkjstr-ui stats`, touched web adapter tests, cache unit tests,
  and `pnpm rust-wasm:quiet`.
- Ledgers: storage area and verification ledger after checks; deletion ledger
  only with no-import proof.
- Keep: TypeScript storage repositories, SQLite OPFS glue, cache maintenance,
  Search storage, and Svelte Stats/cache tabs until Rust parity exists.

## Current Evidence

- Rust manifest and row codecs: `crates/lkjstr-storage/src/**`.
- Batch-capable command metadata shape and matrix:
  `crates/lkjstr-storage/src/commands/**` and
  [../../data/storage/kernel/commands/README.md](../../data/storage/kernel/commands/README.md).
- Rust worker adapter and repository calls:
  `crates/lkjstr-web/src/sqlite_store/**` and
  `crates/lkjstr-web/src/storage_worker/**`.
- Current TypeScript worker glue: `src/lib/storage/sqlite-opfs/**` and
  `src/lib/storage/repositories/**`.
- Focused proof runs for storage slices are recorded in
  [verification-ledger.md](verification-ledger.md). Recent storage cargo,
  Vitest, docs, style, line, and Rust/WASM quiet gates pass when the real Cargo
  path is placed before the local shim.
- Product cutover remains partial because shipped Svelte surfaces still call
  TypeScript repositories for many live reads and maintenance operations.

## Worker Message Contract

`lkjstr-storage` owns table names, SQL statement ids, row codecs, data classes,
ledger resource kinds, command metadata, and typed outcomes. Command metadata
must describe batch-shaped operations by statement ids, tables, ledger policy,
protection policy, and Stats projection instead of one-table shorthand.

`lkjstr-web` borrows the JavaScript app broker for the product database instead
of acquiring a fresh Web Lock or constructing a persistent worker per Rust
island. The broker owns the origin-level `lkjstr.sqlite-opfs-owner` Web Lock
before persistent worker construction, then sends worker messages through
`StorageOp`: `open`, `apply-schema`, `query`, `execute`, `batch`,
`get-storage-health`, `read-physical-inventory`, `estimate-storage`, `cancel`,
and `close`. Product crates never format SQL or open OPFS.

Accounts active selection reads and writes the protected SQLite selector row.
The old `lkjstr.activeAccountId` localStorage key is migration-only and is
removed after a successful selector write.

Active selector, pressure, protected rows, event cache, feed evidence,
diagnostics, notifications, jobs, app log, inventory snapshot, optimizer rows,
retention planner, retention delete dispatch, repair scan, repair backfill,
repair inventory report, repair target probes, Search token rows, tag lookup,
event-write token batch steps, and local indexed Search query adapters are
implemented at the storage and web-adapter boundary.

Rust app retention and repair planning consumes the storage-owned readiness
classifier. Search app planning, NIP-50 merge, and surface parity remain open.
Pressure inventory has a storage-owned readiness classifier, while browser byte
estimates remain open. Broker owner denial and SAH-pool access-handle contention
map to busy/unavailable outcomes before protected repositories can render empty
rows.

## Detail Map

- [storage-wiring-families.md](storage-wiring-families.md): storage family source maps and deletion conditions.

## Deletion Proof

For any row, record the exact Rust replacement files in
[deletion-ledger.md](deletion-ledger.md), run the focused gate, then prove no
imports of the TypeScript path remain with `rg` over `src`, `tests`, and
`scripts`. Deletion happens in the same coherent change as the ledger update.

## Must Not Clauses

- No fake data.
- No placeholder success.
- No direct browser database access from product code.
- No unbounded arrays.
- No hidden global state.
- No deletion before parity proof.
- No status claim without source/test evidence.
