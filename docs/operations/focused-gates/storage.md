# Storage Focused Gates

## Purpose

This file owns focused gates for storage and cache changes.

## Gates

## Storage And Cache

```sh
pnpm check:repo
pnpm test -- tests/unit/cache/storage-quota.test.ts tests/unit/cache/compaction.test.ts
pnpm test -- tests/unit/cache/cache-status.test.ts tests/unit/cache/cache-ledger.test.ts
pnpm test -- tests/unit/storage tests/unit/events/repository.test.ts tests/unit/settings/settings-store.test.ts
```

Acceptance: default budget is `67108864`, byte accounting works without browser
estimates, lowering the setting enforces immediately, protected tables survive,
Stats reports the last enforcement result, and
[storage-pressure-verification.md](../storage-pressure-verification.md) passes.
