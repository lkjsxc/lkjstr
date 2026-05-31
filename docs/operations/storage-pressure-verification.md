# Storage Pressure Verification

## Purpose

This scenario proves cache-budget enforcement uses real browser storage and does
not treat unknown origin usage as success.

## Scenario

1. Start the app with real IndexedDB enabled.
2. Set `cache.maxBytes` to a tiny budget such as `1048576` bytes through the
   real settings store path.
3. Seed protocol-shaped prunable cache rows in the actual `lkjstr` Dexie
   database: events, event relay receipts, tag rows, notifications, feed/page
   rows, diagnostics, and matching `cacheLedger` rows.
4. Keep protected rows present: settings, workspace, account metadata, relay
   sets, drafts, active jobs, active tab snapshots, and route-block safety rows
   when the test owns them.
5. Trigger the real manual `Compact now` action or call the public app storage
   path used by that action.
6. Refresh Stats through the real cache status path.

## Assertions

- Prunable rows decrease when browser usage is above the configured target.
- Protected rows remain.
- Deleted resources do not leave orphan ledger rows.
- Stats shows last compaction reason, pruned resource count, pruned bytes,
  ledger row count, orphan rows, missing rows, pressure state, and final stop
  reason.
- Stats separates table-estimated bytes, localStorage bytes, Cache Storage
  bytes, unknown legacy or unowned storage, and residual browser overhead.
- `Repair storage` deletes orphan ledger rows, backfills missing rows, removes
  safe unowned cache rows, and never adds ledger rows for protected route
  blocks.
- If browser usage remains over target, Stats reports `candidate-limited`,
  `no-prunable-candidates`, `protected-only`, `unknown-unowned-usage`,
  `inventory-incomplete`, `quota-pressure`, `quota-unavailable`,
  `storage-api-unavailable`, or `compaction-error`; it must not report silent
  success.

## Commands

```sh
pnpm check:repo
pnpm test -- tests/unit/cache/storage-quota.test.ts tests/unit/cache/compaction.test.ts tests/unit/cache/cache-status.test.ts
pnpm test -- tests/unit/settings/settings-store.test.ts tests/unit/events/repository.test.ts
pnpm test:e2e -- tests/e2e/storage-pressure.spec.ts
```
