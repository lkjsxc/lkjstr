# Storage Kernel

## Purpose

The Storage Kernel owns executable storage truth: the table manifest,
repository boundary, typed operation results, SQLite schema helpers, and
failure-recovery behavior.

## Table of Contents

- [manifest.md](manifest.md): manifest fields and consumers.
- [schema-steps.md](schema-steps.md): SQLite schema change rules.
- [operation-results.md](operation-results.md): typed storage outcomes.
- [transactions.md](transactions.md): transactional write families.
- [repositories.md](repositories.md): feature-facing storage boundary.
- [commands/README.md](commands/README.md): storage command metadata matrix.
- [failure-recovery.md](failure-recovery.md): degraded startup and session fallback.
- [local-secrets.md](local-secrets.md): local signing secret boundary.

## Contract

- OPFS SQLite is the durable storage kernel.
- Feature modules call repository functions instead of selecting database tables.
- Storage operations report typed outcomes before callers collapse to fallbacks.
- Runtime counters for storage work decrement on actual settlement, not on the
  moment a fallback returns.
- Startup recovers to a usable Welcome workspace when durable storage is
  unavailable.
- First-party source classes are not allowed.

## Source Targets

- `src/lib/storage/sqlite-opfs/`: SQLite worker host glue and repositories.
- `src/lib/storage/schema/`: logical manifest and inventory groups.
- `src/lib/storage/operation/`: results, deadlines, and operation tracking.
- `src/lib/storage/repositories/`: feature-facing storage repositories.
