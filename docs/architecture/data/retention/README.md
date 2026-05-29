# Event Retention

## Purpose

Event retention defines enforced byte-budget eviction for stored Nostr events.
Durable cache growth is not capped by a fixed application event count.

## Table of Contents

- [index-shape.md](index-shape.md): IndexedDB priority store fields.
- [score-policy.md](score-policy.md): score updates and protected classes.
- [compaction.md](compaction.md): byte-budget compaction.

## Contract

- Cache retention is automatic under the configured `cache.maxBytes` byte
  budget. Browser quota pressure is an additional emergency signal.
- Users tune only the byte budget in Settings. They do not tune event count,
  age, or compaction enablement.
- Stats shows cache diagnostics and the last enforcement result.
- Hard-protected events never score-evict.
- All other cached events compete on a durable relation score updated only when
  new structural information arrives.
- Score does not decay over time. Ties break by event recency.
- Budget compaction evicts lowest-ranked events using indexed priority rows,
  not routine full-table event scans.
