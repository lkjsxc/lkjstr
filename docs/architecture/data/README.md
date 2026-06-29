# Data Architecture

## Purpose

Data docs define storage, feed windows, and shared event presentation models.
Start new storage work in [sqlite-opfs/README.md](sqlite-opfs/README.md) and
read the current live storage state in [storage/README.md](storage/README.md).

## Table of Contents

- [event-tree.md](event-tree.md): common event tree rendering model.
- [bounded-memory.md](bounded-memory.md): bounded memory and cleanup rules.
- [feed-surface.md](feed-surface.md): index for shared feed list, prefetch, and
  staged row pipeline ([feed-surface/](feed-surface/README.md)).
- [feed-surface/feed-row-chrome.md](feed-surface/feed-row-chrome.md): feed row
  separators.
- [feed-surface/feed-scroll-surface.md](feed-surface/feed-scroll-surface.md):
  shared feed scroll shell.
- [feed-surface/footer-phase.md](feed-surface/footer-phase.md): footer phase.
- [feed-surface/geometry-model.md](feed-surface/geometry-model.md): durable row
  geometry keys, reservations, estimates, and anchors.
- [feed-surface/unload-height-stability.md](feed-surface/unload-height-stability.md):
  stable reservations through unload and dematerialization.
- [feed-surface/enrichment-height-tiers.md](feed-surface/enrichment-height-tiers.md):
  structural vs enrichment height collapse on dematerialization.
- [feed-surface/repost-rendering.md](feed-surface/repost-rendering.md): shared
  event rendering for repost targets.
- [feed-surface/long-content.md](feed-surface/long-content.md): oversized event
  visual fragments.
- [feed-surface/near-end.md](feed-surface/near-end.md): near-end paging.
- [feed-surface/older-load-mode.md](feed-surface/older-load-mode.md): older
  load gating.
- [feed-surface/event-value.md](feed-surface/event-value.md): visible row value
  and display-bound feed insertion.
- [feed-surface/height-reservation.md](feed-surface/height-reservation.md): row
  geometry and scroll-anchor compensation.
- [feed-surface/lod-tree.md](feed-surface/lod-tree.md): real-data feed LOD tree.
- [feed-surface/scroll-regression-tests.md](feed-surface/scroll-regression-tests.md):
  scroll regression matrix.
- [feed-surface/staged-pipeline.md](feed-surface/staged-pipeline.md): staged
  row loading.
- [feed-surface/surface-matrix.md](feed-surface/surface-matrix.md): surface
  matrix.
- [event-surface-paging.md](event-surface-paging.md): near-end and footer
  constants; defers to feed-surface.
- [feed-memory.md](feed-memory.md): runtime feed windows and durable cache
  policy.
- [cache-first-feed-pages.md](cache-first-feed-pages.md): strict cache-first
  proof for bounded grouped feed pages.
- [feed-coverage.md](feed-coverage.md): durable evidence for complete feed
  ranges and cache-first rendering.
- [heap-retention.md](heap-retention.md): observed symptoms and investigation
  strategy.
- [resource-ownership.md](resource-ownership.md): who creates and who closes
  each resource.
- [storage/README.md](storage/README.md): storage kernel entry point.
- [sqlite-opfs/README.md](sqlite-opfs/README.md): OPFS SQLite storage target.
- [sqlite-opfs/runtime.md](sqlite-opfs/runtime.md): worker runtime and VFS behavior.
- [sqlite-opfs/owner-lifecycle.md](sqlite-opfs/owner-lifecycle.md): storage owner lifecycle.
- [sqlite-opfs/storage-modes.md](sqlite-opfs/storage-modes.md): persistent and temporary modes.
- [sqlite-opfs/schema.md](sqlite-opfs/schema.md): SQLite table groups.
- [sqlite-opfs/worker-protocol.md](sqlite-opfs/worker-protocol.md): worker messages.
- [sqlite-opfs/query-ownership.md](sqlite-opfs/query-ownership.md): SQL-owned reads and memory state.
- [sqlite-opfs/repositories.md](sqlite-opfs/repositories.md): repository rules.
- [sqlite-opfs/migration-map.md](sqlite-opfs/migration-map.md): cutover table map.
- [sqlite-opfs/retention.md](sqlite-opfs/retention.md): cache retention.
- [sqlite-opfs/failure-recovery.md](sqlite-opfs/failure-recovery.md): startup and reset recovery.
- [sqlite-opfs/import-export.md](sqlite-opfs/import-export.md): import/export.
- [storage/kernel/README.md](storage/kernel/README.md): manifest, operations,
  transactions, and repositories.
- [storage/kernel/manifest.md](storage/kernel/manifest.md): executable table
  manifest contract.
- [storage/kernel/schema-steps.md](storage/kernel/schema-steps.md): SQLite
  schema change rules.
- [storage/kernel/operation-results.md](storage/kernel/operation-results.md):
  typed storage outcomes.
- [storage/kernel/transactions.md](storage/kernel/transactions.md):
  transactional write families.
- [storage/kernel/repositories.md](storage/kernel/repositories.md):
  repository boundary.
- [storage/kernel/commands/README.md](storage/kernel/commands/README.md): storage command metadata matrix.
- [storage/kernel/commands/diagnostics.md](storage/kernel/commands/diagnostics.md): diagnostics commands.
- [storage/kernel/commands/event-cache.md](storage/kernel/commands/event-cache.md): event-cache commands.
- [storage/kernel/commands/feed-evidence.md](storage/kernel/commands/feed-evidence.md): feed evidence commands.
- [storage/kernel/commands/protected.md](storage/kernel/commands/protected.md): protected commands.
- [storage/kernel/commands/repair.md](storage/kernel/commands/repair.md): repair commands.
- [storage/kernel/commands/retention.md](storage/kernel/commands/retention.md): retention commands.
- [storage/kernel/commands/search.md](storage/kernel/commands/search.md): Search token and tag commands.
- [storage/kernel/failure-recovery.md](storage/kernel/failure-recovery.md):
  degraded startup and session fallback.
- [storage/kernel/local-secrets.md](storage/kernel/local-secrets.md): local
  signing secret boundary.
- [storage/data-classes/README.md](storage/data-classes/README.md): durable
  data classes.
- [storage/data-classes/ownership-classes.md](storage/data-classes/ownership-classes.md):
  exact ownership classes.
- [storage/data-classes/table-manifest.md](storage/data-classes/table-manifest.md):
  live table matrix.
- [storage/data-classes/feed-coverage-correctness.md](storage/data-classes/feed-coverage-correctness.md):
  feed proof validity.
- [storage/data-classes/tab-snapshots.md](storage/data-classes/tab-snapshots.md):
  tab-state persistence.
- [storage/retention/README.md](storage/retention/README.md): storage
  retention contract.
- [storage/retention/ledger.md](storage/retention/ledger.md): shared cache
  ledger.
- [storage/retention/byte-accounting.md](storage/retention/byte-accounting.md):
  deterministic estimates.
- [storage/retention/scoring.md](storage/retention/scoring.md): scoring policy.
- [storage/retention/dynamic-protection.md](storage/retention/dynamic-protection.md):
  runtime protection.
- [storage/retention/deletion.md](storage/retention/deletion.md): delete
  dispatchers.
- [storage/retention/repair.md](storage/retention/repair.md): ledger repair.
- [storage/diagnostics/README.md](storage/diagnostics/README.md): diagnostics
  index.
- [storage/diagnostics/inventory.md](storage/diagnostics/inventory.md):
  storage inventory.
- [storage/diagnostics/pressure-states.md](storage/diagnostics/pressure-states.md):
  pressure labels.
- [storage/diagnostics/stats.md](storage/diagnostics/stats.md): Stats
  projection.
- [storage/diagnostics/verification.md](storage/diagnostics/verification.md):
  storage checks.
- [local-secret-security.md](local-secret-security.md): passkey-protected
  secret design boundary.
- [memory-prioritization.md](memory-prioritization.md): durable data and
  runtime retention priority.
- [relay-pages.md](relay-pages.md): relay page ordering and provenance.
- [../../operations/storage-pressure-verification.md](../../operations/storage-pressure-verification.md):
  cache-budget storage pressure verification scenario.
- Workspace tab snapshot fields live in
  [../workspace/tab-snapshot-fields.md](../workspace/tab-snapshot-fields.md).

## Shared Contract

- Stored events are normalized through one repository path before runtime or UI
  use.
- Missing, empty, or stale relay arrays become `cache` provenance.
- Optional persisted fields receive safe defaults during reads.
- Derived indexes are normalized or rebuilt without clearing user-owned records.
- Long-lived memory maps declare a size, time bound, or deterministic owner.
- Prunable browser-local cache records register in `cacheLedger` with score,
  byte estimate, owner kind, resource kind, and deletion identity.

## All Files

```text
`bounded-memory.md` `cache-first-feed-pages.md` `event-surface-paging.md` `event-tree.md` `feed-coverage.md` `feed-memory.md` `feed-surface/README.md`
`feed-surface/enrichment-height-tiers.md` `feed-surface/event-value.md` `feed-surface/feed-row-chrome.md` `feed-surface/feed-scroll-surface.md` `feed-surface/footer-phase.md` `feed-surface/geometry-model-keys.md` `feed-surface/geometry-model-persistence.md`
`feed-surface/geometry-model.md` `feed-surface/height-reservation.md` `feed-surface/lod-tree.md` `feed-surface/long-content.md` `feed-surface/near-end.md` `feed-surface/older-load-mode.md` `feed-surface/repost-rendering.md`
`feed-surface/scroll-regression-tests.md` `feed-surface/staged-pipeline.md` `feed-surface/surface-matrix.md` `feed-surface/unload-height-stability.md` `feed-surface.md` `heap-retention.md` `local-secret-security.md`
`memory-prioritization.md` `relay-pages.md` `resource-ownership.md` `sqlite-opfs/README.md` `sqlite-opfs/failure-recovery.md` `sqlite-opfs/import-export.md` `sqlite-opfs/migration-map.md` `sqlite-opfs/owner-lifecycle.md`
`sqlite-opfs/query-ownership.md` `sqlite-opfs/repositories.md` `sqlite-opfs/retention.md` `sqlite-opfs/runtime.md` `sqlite-opfs/schema.md` `sqlite-opfs/storage-modes.md` `sqlite-opfs/worker-protocol.md`
`storage/README.md` `storage/data-classes/README.md` `storage/data-classes/feed-coverage-correctness.md` `storage/data-classes/ownership-classes.md` `storage/data-classes/tab-snapshots.md` `storage/data-classes/table-manifest.md` `storage/diagnostics/README.md`
`storage/diagnostics/inventory.md` `storage/diagnostics/pressure-states.md` `storage/diagnostics/stats.md` `storage/diagnostics/verification.md` `storage/kernel/README.md` `storage/kernel/commands/README.md` `storage/kernel/commands/diagnostics.md`
`storage/kernel/commands/event-cache.md` `storage/kernel/commands/feed-evidence.md` `storage/kernel/commands/protected.md` `storage/kernel/commands/repair.md` `storage/kernel/commands/retention.md` `storage/kernel/commands/search.md` `storage/kernel/failure-recovery.md`
`storage/kernel/local-secrets.md` `storage/kernel/manifest.md` `storage/kernel/operation-results.md` `storage/kernel/repositories.md` `storage/kernel/schema-steps.md` `storage/kernel/transactions.md` `storage/retention/README.md`
`storage/retention/byte-accounting.md` `storage/retention/deletion.md` `storage/retention/dynamic-protection.md` `storage/retention/ledger.md` `storage/retention/repair.md` `storage/retention/scoring.md`
```
