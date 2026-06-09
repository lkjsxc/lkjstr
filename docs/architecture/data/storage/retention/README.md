# Storage Retention

## Purpose

Storage retention keeps browser-owned recoverable cache within the configured
byte target without deleting protected records.

## Table of Contents

- [ledger.md](ledger.md): shared cache ledger.
- [byte-accounting.md](byte-accounting.md): deterministic byte estimates.
- [scoring.md](scoring.md): retention priority.
- [dynamic-protection.md](dynamic-protection.md): runtime protection snapshot.
- [deletion.md](deletion.md): delete dispatcher contract.
- [repair.md](repair.md): ledger repair and backfill.

## Agent Start

- Current source owner: `lkjstr-storage/src/retention/` owns planning;
  TypeScript cache maintenance still dispatches shipped cleanup.
- Desired Rust owner: `lkjstr-storage` keeps policy and `lkjstr-web` executes
  table-specific worker batches.
- First source edit: repair models after retention worker failure proof.
- Focused tests: storage retention tests, web retention tests, cache-ledger web
  tests, cache unit tests, and `pnpm rust-wasm:quiet`.
- Ledgers: update storage area and verification ledger after checks run.
- Keep: `cache-ledger-*.ts`, `cache-compaction-sqlite.ts`, `src/lib/cache/**`,
  and shipped Stats/cache tabs until Rust retention product proof exists.

## Contract

- `cacheLedger` is the only eviction queue.
- Users tune the byte target, not resource row counts.
- Browser usage estimates are authoritative for origin usage when available.
- IndexedDB table estimates and ledger estimates are diagnostics.
- Selection uses score, then recency, then id.
- Durable and dynamic protection skip candidates.
- `lkjstr-storage` owns pure retention planning; `lkjstr-web` owns worker
  delete dispatch.
- Every deletion uses a resource-kind dispatcher.
- Every stop records a concrete reason instead of reporting success from
  ledger bytes alone.
- Every repair path is chunked or bounded before it is allowed on large stores.
