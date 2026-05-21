# Data Architecture

## Purpose

Data docs define storage, feed windows, and shared event presentation models.

## Documents

- [event-tree.md](event-tree.md): common event tree rendering model.
- [feed-memory.md](feed-memory.md): bounded feed loading and cache pruning.
- [shared-storage.md](shared-storage.md): event and feed repository.
- [storage.md](storage.md): browser persistence ownership.

## Shared Contract

- Stored events are normalized through one repository path before runtime or UI
  use.
- Missing, empty, or stale relay arrays become `cache` provenance.
- Optional persisted fields receive safe defaults during reads.
