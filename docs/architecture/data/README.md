# Data Architecture

## Purpose

Data docs define storage, feed windows, and shared event presentation models.

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
- [feed-surface/near-end.md](feed-surface/near-end.md): near-end paging.
- [feed-surface/older-load-mode.md](feed-surface/older-load-mode.md): older
  load gating.
- [feed-surface/event-value.md](feed-surface/event-value.md): visible row value
  and display-bound feed insertion.
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
- [local-cache-ledger.md](local-cache-ledger.md): shared byte-accounting ledger.
- [storage-table-contract.md](storage-table-contract.md): live table map for
  retention, Stats, deletion, and repair behavior.
- [retention/README.md](retention/README.md): score-based local-cache retention.
- [retention/compaction.md](retention/compaction.md): compaction workflow.
- [retention/index-shape.md](retention/index-shape.md): ledger indexes.
- [retention/score-policy.md](retention/score-policy.md): scoring policy.
- [local-secret-security.md](local-secret-security.md): passkey-protected
  secret design boundary.
- [memory-prioritization.md](memory-prioritization.md): durable data and
  runtime retention priority.
- [relay-pages.md](relay-pages.md): relay page ordering and provenance.
- [shared-storage.md](shared-storage.md): event and feed repository.
- [storage.md](storage.md): browser persistence ownership.
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
