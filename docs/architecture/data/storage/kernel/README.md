# Storage Kernel

## Purpose

The Storage Kernel owns executable storage truth: the table manifest, Dexie
schema shape, typed operation results, repository boundary, transaction helper,
and failure-recovery behavior.

## Table of Contents

- [manifest.md](manifest.md): manifest fields and consumers.
- [schema-steps.md](schema-steps.md): Dexie schema step rules.
- [operation-results.md](operation-results.md): typed storage outcomes.
- [transactions.md](transactions.md): transactional write families.
- [repositories.md](repositories.md): feature-facing storage boundary.
- [failure-recovery.md](failure-recovery.md): degraded startup and session fallback.
- [local-secrets.md](local-secrets.md): local signing secret boundary.

## Contract

- IndexedDB through Dexie is the only durable application store.
- The Dexie binding class is the only first-party class allowed in source.
- Feature modules call repository functions instead of selecting Dexie tables.
- Storage operations report typed outcomes before callers collapse to fallbacks.
- Runtime counters for IndexedDB work decrement on actual settlement, not on
  the moment a fallback returns.
- Startup recovers to a usable Welcome workspace when storage is unavailable.

## Source Targets

- `src/lib/storage/browser-db.ts`: Dexie binding and singleton.
- `src/lib/storage/schema/`: table manifest and generated schema shape.
- `src/lib/storage/operation/`: results, deadlines, operation tracking, transactions.
- `src/lib/storage/repositories/`: feature-facing storage repositories.
