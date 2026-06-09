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
