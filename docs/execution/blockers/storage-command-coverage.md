# Storage command coverage (implemented enabling proof)

## Purpose

Implemented storage command coverage blocker details.

## Details

Preserve completed storage command coverage for retention, repair, full
pressure inventory diagnostics, and Rust Stats consumption.

Preserve implemented active selector, pressure, protected, event cache, feed
evidence, diagnostics, notifications, jobs, app log, inventory, optimizer,
retention, repair metadata and probes, and Search token, tag, and local-query
metadata.

- Cutover-ledger rows: [Protected tool storage](../../architecture/rust-wasm/cutover/implementation-ledger.md)
  and [Event cache and feed evidence](../../architecture/rust-wasm/cutover/implementation-ledger.md).
- Docs to read: [storage README](../../architecture/data/storage/README.md),
  [SQLite OPFS README](../../architecture/data/sqlite-opfs/README.md),
  [repository contract](../../architecture/data/sqlite-opfs/repositories.md),
  [storage kernel](../../architecture/rust-wasm/storage-kernel.md), and
  [storage wiring](../../architecture/rust-wasm/cutover/storage-wiring.md).
- Crates: `lkjstr-storage`, `lkjstr-web`, `lkjstr-app`, and `lkjstr-ui`.
- Shipped source paths: `crates/lkjstr-storage/`,
  `crates/lkjstr-web/src/sqlite_store/`, `src/lib/storage/sqlite-opfs/`,
  `src/lib/storage/repositories/`, `tests/unit/cache/`,
  `tests/unit/events/repository.test.ts`, and
  `tests/unit/feed-surface/scan-model-repository.test.ts`.
- Focused tests: `cargo test -p lkjstr-storage`,
  `cargo test -p lkjstr-web`,
  `pnpm test -- tests/unit/cache tests/unit/events/repository.test.ts`,
  `pnpm test -- tests/unit/feed-surface/scan-model-repository.test.ts`, and
  `pnpm rust-wasm:quiet`.
- Completed proof: batch-capable Rust command specs cover implemented
  families, retention delete dispatch, repair metadata and probes, Search
  token, tag, and local-query metadata, current pressure byte projections,
  pressure-state mapping tests, UI Stats unavailable-state tests, storage-owned
  inventory readiness classification, and readiness-gated retention/repair app
  planning.
- Next queue: shared feed runtime. Preserve Search provider execution and
  snapshot restore proof, then return to feed/runtime storage consumers and
  broader storage parity only after their dependency rows are ready. Protected rows are never pruned;
  ledgers stay partial unless no-import proof exists.
