# Data Architecture

## Purpose

Data docs define storage, feed windows, and shared event presentation models.

## Documents

- [event-tree.md](event-tree.md): common event tree rendering model.
- [bounded-memory.md](bounded-memory.md): bounded memory and cleanup rules.
- [feed-surface.md](feed-surface.md): index for shared feed list, prefetch, and
  staged row pipeline ([feed-surface/](feed-surface/README.md)).
- [event-surface-paging.md](event-surface-paging.md): near-end and footer
  constants; defers to feed-surface.
- [feed-memory.md](feed-memory.md): runtime feed windows and durable cache
  policy.
- [heap-retention.md](heap-retention.md): observed symptoms and investigation
  strategy.
- [resource-ownership.md](resource-ownership.md): who creates and who closes
  each resource.
- [retention/README.md](retention/README.md): score-based event retention.
- [local-secret-security.md](local-secret-security.md): passkey-protected
  secret design boundary.
- [memory-prioritization.md](memory-prioritization.md): durable data and
  runtime retention priority.
- [relay-pages.md](relay-pages.md): relay page ordering and provenance.
- [shared-storage.md](shared-storage.md): event and feed repository.
- [storage.md](storage.md): browser persistence ownership.

## Shared Contract

- Stored events are normalized through one repository path before runtime or UI
  use.
- Missing, empty, or stale relay arrays become `cache` provenance.
- Optional persisted fields receive safe defaults during reads.
- Derived indexes are normalized or rebuilt without clearing user-owned records.
- Long-lived memory maps declare a size, time bound, or deterministic owner.
