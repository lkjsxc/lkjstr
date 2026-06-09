# Storage

## Purpose

Storage is the LLM-first contract for all browser-owned durable data. Read this
directory before changing SQLite tables, cache retention, feed evidence, Stats
inventory, settings persistence, or storage failure recovery. New durable
storage work targets [../sqlite-opfs/README.md](../sqlite-opfs/README.md).

## First Screen Contract

Durable browser data is owned by the Storage Kernel. The kernel is the typed
manifest plus the repository, transaction, ledger, retention, repair, and
diagnostic modules that consume it.

Protected records are never removed by cache pressure. This includes accounts,
local signing secrets, settings, relay sets, workspace layout, Tweet drafts,
active tab snapshots, active jobs, and relay route blocks.

Recoverable cache records may be removed only through `cacheLedger`. Events,
notifications, feed cursors, coverage, scan hints, recoverable relay
diagnostics, protocol cache, route evidence, finished jobs, and stale absent
tab snapshots are recoverable when a ledger row, delete path, repair path, and
byte estimate exist.

All writes use storage repositories. Feature modules should not choose database
tables directly. Repositories target OPFS SQLite.

The current live contract is proved by the manifest docs, SQLite worker tests,
repository checks, storage unit tests, storage pressure focused tests, and Docker
Compose verification.

## Agent Start

- Current source owner: TypeScript SQLite worker repositories plus partial Rust
  protected-tool and Stats storage paths.
- Desired Rust owner: `lkjstr-storage` policy and metadata, `lkjstr-web` worker
  adapters, `lkjstr-app` product composition, and `lkjstr-ui` Stats models.
- Next source edit: focused worker failure proof for retention dispatch, then
  conservative repair command models.
- Focused tests: `cargo test -p lkjstr-storage retention`,
  `cargo test -p lkjstr-web retention`, cache unit tests, and
  `pnpm rust-wasm:quiet`.
- Ledgers: update the storage cutover area and verification ledger only with
  commands that actually ran.
- Keep: `src/lib/storage/sqlite-opfs/**`, `src/lib/storage/repositories/**`,
  `src/lib/cache/**`, and shipped Stats/cache surfaces until no-import proof.

## Table of Contents

- [kernel/README.md](kernel/README.md): manifest, operations, transactions, and repositories.
- [kernel/manifest.md](kernel/manifest.md): executable table manifest contract.
- [kernel/schema-steps.md](kernel/schema-steps.md): SQLite schema change rules.
- [kernel/operation-results.md](kernel/operation-results.md): typed storage outcomes.
- [kernel/transactions.md](kernel/transactions.md): transactional write families.
- [kernel/repositories.md](kernel/repositories.md): repository boundary.
- [kernel/commands/README.md](kernel/commands/README.md): command metadata matrix.
- [kernel/commands/diagnostics.md](kernel/commands/diagnostics.md): diagnostics commands.
- [kernel/commands/event-cache.md](kernel/commands/event-cache.md): event-cache commands.
- [kernel/commands/feed-evidence.md](kernel/commands/feed-evidence.md): feed evidence commands.
- [kernel/commands/protected.md](kernel/commands/protected.md): protected commands.
- [kernel/commands/repair.md](kernel/commands/repair.md): repair commands.
- [kernel/commands/retention.md](kernel/commands/retention.md): retention commands.
- [kernel/failure-recovery.md](kernel/failure-recovery.md): degraded storage startup.
- [kernel/local-secrets.md](kernel/local-secrets.md): local signing secret boundary.
- [data-classes/README.md](data-classes/README.md): durable data classes.
- [data-classes/ownership-classes.md](data-classes/ownership-classes.md): exact class definitions.
- [data-classes/table-manifest.md](data-classes/table-manifest.md): live table matrix.
- [data-classes/feed-coverage-correctness.md](data-classes/feed-coverage-correctness.md): feed proof validity.
- [data-classes/tab-snapshots.md](data-classes/tab-snapshots.md): tab-state persistence.
- [retention/README.md](retention/README.md): cache retention contract.
- [retention/ledger.md](retention/ledger.md): shared eviction queue.
- [retention/byte-accounting.md](retention/byte-accounting.md): deterministic estimates.
- [retention/scoring.md](retention/scoring.md): priority policy.
- [retention/dynamic-protection.md](retention/dynamic-protection.md): runtime protection.
- [retention/deletion.md](retention/deletion.md): delete dispatchers.
- [retention/repair.md](retention/repair.md): ledger repair and backfill.
- [diagnostics/README.md](diagnostics/README.md): inventory, pressure, Stats, checks.
- [diagnostics/inventory.md](diagnostics/inventory.md): table inventory.
- [diagnostics/pressure-states.md](diagnostics/pressure-states.md): pressure labels.
- [diagnostics/stats.md](diagnostics/stats.md): Stats projection.
- [diagnostics/verification.md](diagnostics/verification.md): required checks.
- [../sqlite-opfs/README.md](../sqlite-opfs/README.md): OPFS SQLite target.

## Kernel Rule

The Storage Manifest is the source for logical table names, data classes,
inventory groups, ledger resource ownership, compaction flags, and repair flags.
SQLite schema modules own raw table shape.

Old browser stores are not live manifest entries. Diagnostics report them by
presence only, so live table checks stay unambiguous.

## Write Rule

Protected writes return explicit success or failure. Cache and diagnostics
writes may continue the UI on failure, but the storage layer records typed
outcomes so Stats can report unavailable, timeout, quota, blocked, corrupt, or
late-settled work.

Ledger-backed resource writes store the resource row and ledger row in the same
transaction. A table-specific write followed later by a separate ledger update
is not an acceptable steady state.

## Retention Rule

`cacheLedger` is the only eviction queue. Cache pressure deletes by manifest
dispatcher, skips durable and dynamic protection, and records the pressure state
that remains. If all eligible rows are gone and the browser still reports high
usage, Stats must show protected data, overhead, incomplete inventory, or
unavailable APIs instead of a silent success.
