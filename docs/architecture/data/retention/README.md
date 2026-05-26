# Event Retention

## Purpose

Event retention defines optional quota-pressure eviction for stored Nostr
events. Durable cache growth is not capped by a fixed application event count.

## Documents

- [index-shape.md](index-shape.md): IndexedDB priority store fields.
- [score-policy.md](score-policy.md): score updates and protected classes.
- [compaction.md](compaction.md): optional quota-pressure eviction.

## Contract

- Cache retention is automatic only under browser quota pressure. Users do not
  tune event count or age limits in Settings.
- Stats shows cache diagnostics; Settings does not expose compaction knobs.
- Hard-protected events never score-evict.
- All other cached events compete on a durable relation score updated only when
  new structural information arrives.
- Score does not decay over time. Ties break by event recency.
- Quota-pressure compaction evicts lowest-ranked events using indexed queries,
  not full-table scans.
