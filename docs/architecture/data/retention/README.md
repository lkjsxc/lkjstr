# Local Cache Retention

## Purpose

Local cache retention defines enforced byte-budget eviction for every
recoverable browser-local cache resource. Durable cache growth is not capped by
a fixed application row count.

## Table of Contents

- [index-shape.md](index-shape.md): IndexedDB ledger store fields.
- [score-policy.md](score-policy.md): score updates and protected classes.
- [compaction.md](compaction.md): byte-budget compaction.

## Contract

- Cache retention is automatic under the configured `cache.maxBytes` byte
  budget. Browser quota pressure is an additional emergency signal.
- Users tune only the byte budget in Settings. They do not tune cache row count,
  row age, or compaction enablement.
- Stats shows cache diagnostics and the last enforcement result.
- `cacheLedger` is the shared durable byte-accounting and retention ledger for
  prunable browser-local cache records.
- Events are one cache resource class in the ledger. They are not special from
  a budget perspective.
- Notifications, feed cursors, feed coverage, feed scan hints, recoverable relay
  diagnostics, relay information, route evidence, finished jobs, and stale tab
  snapshots are ledger-managed when they are recoverable.
- User-owned records remain protected: accounts, local signing secrets,
  settings, relay sets, Tweet drafts, workspace layout, active tab snapshots,
  active jobs, and explicit safety/configuration state.
- Score does not decay in a background process. Scores update when rows are
  written, read, marked, or structurally related. Ties break by resource
  recency, then id.
- Budget compaction evicts lowest-ranked ledger rows using indexed ledger
  queries, not routine full-table scans of cache resource stores.
