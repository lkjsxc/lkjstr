# Event Retention

## Purpose

Event retention defines automatic cache eviction for stored Nostr events.

## Documents

- [index-shape.md](index-shape.md): IndexedDB priority store fields.
- [score-policy.md](score-policy.md): score updates and protected classes.
- [compaction.md](compaction.md): eviction queries and invariants.

## Contract

- Cache retention is automatic. Users do not tune event count or age limits.
- Stats shows cache diagnostics; Settings does not expose compaction knobs.
- Hard-protected events never score-evict.
- All other cached events compete on a durable relation score updated only when
  new structural information arrives.
- Score does not decay over time. Ties break by event recency.
- Compaction evicts lowest-ranked events using indexed queries, not full-table
  scans.
