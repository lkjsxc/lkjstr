# Storage Kernel

## Purpose

The Storage Kernel owns executable storage truth: the current table manifest,
repository boundary, typed operation results, transaction helpers, and
failure-recovery behavior.

## Table of Contents

- [manifest.md](manifest.md): manifest fields and consumers.
- [schema-steps.md](schema-steps.md): current IndexedDB schema step rules.
- [operation-results.md](operation-results.md): typed storage outcomes.
- [transactions.md](transactions.md): transactional write families.
- [repositories.md](repositories.md): feature-facing storage boundary.
- [failure-recovery.md](failure-recovery.md): degraded startup and session fallback.
- [local-secrets.md](local-secrets.md): local signing secret boundary.

## Contract

- OPFS SQLite is the target durable storage kernel.
- IndexedDB through Dexie remains only for storage families not yet cut over.
- Feature modules call repository functions instead of selecting database tables.
- Storage operations report typed outcomes before callers collapse to fallbacks.
- Runtime counters for storage work decrement on actual settlement, not on the
  moment a fallback returns.
- Startup recovers to a usable Welcome workspace when durable storage is
  unavailable.
- First-party source classes are not allowed; the current Dexie binding uses a
  factory and plain typed data.

## Source Targets

- `src/lib/storage/sqlite-opfs/`: SQLite worker host glue and cutover
  repositories.
- `src/lib/storage/browser-db.ts`: current Dexie binding kept for deletion-only
  storage families.
- `src/lib/storage/schema/`: current manifest and generated IndexedDB shape.
- `src/lib/storage/operation/`: results, deadlines, operation tracking,
  transactions.
- `src/lib/storage/repositories/`: feature-facing storage repositories.
