# Skill: Stats Diagnostics

## Purpose

Make Stats and lkjstr Log render real storage, relay, optimizer, jobs, memory,
geometry, and diagnostic states with exact unavailable reasons and bounded rows.

## Trigger

Use when editing Stats, lkjstr Log, runtime counters, storage pressure,
optimizer diagnostics, row-height diagnostics, relay diagnostics, or redaction.

## Read First

- [../../product/tools/stats.md](../../product/tools/stats.md).
- [../../product/tools/log.md](../../product/tools/log.md).
- [../../architecture/data/storage/diagnostics/README.md](../../architecture/data/storage/diagnostics/README.md).
- [../../architecture/orchestration/stats.md](../../architecture/orchestration/stats.md).
- [../../operations/memory-verification.md](../../operations/memory-verification.md).

## Files Likely Touched

- `crates/lkjstr-storage/` diagnostics, inventory, pressure, and app-log rows.
- `crates/lkjstr-app/` diagnostics view models.
- `crates/lkjstr-ui/src/workspace/stats*` and `log*`.
- `crates/lkjstr-web/` storage, relay, and diagnostic bridges.
- `src/lib/memory/`, `src/lib/log/`, `src/lib/tabs/stats/`, and tests.

## Procedure

1. Update Stats or Log product docs before source changes.
2. Render only real rows or explicit unavailable, timeout, blocked, corrupt, memory-fallback, or unsupported states.
3. Keep row lists bounded and keyed by stable aggregate names.
4. Redact secrets and event-sensitive values before storage or display.
5. Prefer storage-owned readiness classifiers over count-only cleanup claims.

## Focused Gate

```sh
pnpm test -- tests/unit/log tests/unit/storage tests/unit/relays
pnpm test -- tests/unit/memory tests/unit/app/runtime-counters.test.ts
cargo test -p lkjstr-storage stats
pnpm verify:quiet
```

## Final Gate

Run Docker final gate before broad diagnostics parity or deletion claims.

## Must Not

- Do not show placeholder counters or indefinite loading.
- Do not hide unavailable reasons.
- Do not expose local signing secrets, auth headers, or raw private material.

## Handoff

List real data sources, unavailable reasons, bounds, redaction proof, tests, and
remaining diagnostics gaps.
