# Storage Pressure Verification

## Purpose

Storage pressure verification proves cache-budget enforcement uses real storage
signals, protects user data, and reports exact stop reasons instead of treating
unknown origin usage as success.

## Scenario

1. Start the SQLite worker in OPFS mode or explicit temporary-memory mode.
2. Set `cache.maxBytes` to a tiny budget such as `1048576` bytes through the
   real settings repository path.
3. Seed protocol-shaped prunable SQLite rows: events, relay receipts, tag rows,
   notifications, feed/page rows, diagnostics, and matching `cacheLedger` rows.
4. Keep protected SQLite rows present: settings, workspace, account metadata,
   relay sets, drafts, active jobs, active tab snapshots, and route-block safety
   rows when the test owns them.
5. Provide a browser quota estimate or a deterministic repository fallback that
   reports usage over budget.
6. Trigger the same public storage compaction path used by the Stats action.
7. Refresh Stats through the storage diagnostics repository path.

## Assertions

- Prunable rows decrease when browser usage is above the configured target.
- Protected rows remain.
- Deleted events also remove relay receipts and tag rows.
- Deleted resources do not leave orphan ledger rows.
- Coverage evidence invalidates conservatively when event rows are deleted.
- Stats shows storage mode, health, last compaction reason, pruned resource
  count, pruned bytes, ledger row count, orphan rows, missing rows, pressure
  state, and final stop reason.
- Stats separates SQLite table estimates, ledger bytes, localStorage bytes,
  Cache Storage bytes, old IndexedDB database presence, unknown old or unowned
  storage, and residual browser overhead.
- Rust Stats pressure rows show browser usage, site target, protected bytes,
  prunable bytes, unknown or unowned bytes, and residual overhead only when a
  real pressure snapshot exists; missing pressure data stays visible as
  unavailable.
- Rust Stats inventory rows show localStorage count/status/bytes, Cache Storage
  count/status/response bytes, and old IndexedDB presence without claiming
  byte-safe cleanup evidence.
- Rust storage readiness links Stats inventory to retention and repair: missing
  pressure rows, partial scans, temporary memory, and old IndexedDB presence use
  exact gap labels instead of byte-safe cleanup claims.
- Repair deletes orphan ledger rows, backfills missing rows, removes safe
  unowned cache rows, and never adds ledger rows for protected route blocks.
- If browser usage remains over target, Stats reports
  `no-prunable-candidates`, `protected-only`, `unknown-unowned-usage`,
  `inventory-incomplete`, `quota-pressure`, `storage-api-unavailable`, or
  `compaction-error`; it must not report silent success.

## Commands

```sh
pnpm check:repo
cargo test -p lkjstr-storage pressure
cargo test -p lkjstr-storage stats
cargo test -p lkjstr-storage commands
cargo test -p lkjstr-ui stats
pnpm test -- tests/unit/cache/storage-quota.test.ts tests/unit/cache/compaction.test.ts
pnpm test -- tests/unit/cache/cache-status.test.ts tests/unit/cache/cache-ledger.test.ts
pnpm test -- tests/unit/events/repository.test.ts tests/unit/settings/settings-store.test.ts
pnpm test -- tests/unit/stats tests/unit/storage 2>/dev/null || pnpm test:quiet
```

The final fallback keeps the command useful while the focused storage test tree
is being organized. New tests should live under the focused storage and Stats
subtrees.
