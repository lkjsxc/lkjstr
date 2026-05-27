# Retention Index Shape

## Purpose

Retention index shape defines how event priority is stored and queried.

## Store

- IndexedDB object store `eventPriority`.
- Primary key: event id.
- Indexes:
  - `score`: ascending queries for lowest-ranked candidates.
  - `createdAt`: tie-break and diagnostics.

## Record Fields

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `id` | string | Event id |
| `score` | number | Current retention score |
| `createdAt` | number | Event `created_at` for tie-break |
| `protected` | boolean | Hard-protected flag when true |

## Update Path

- Ingest and relationship index writers upsert priority rows.
- Compaction reads ascending `score` in batches until the target byte budget is
  met.
- Protected rows are skipped during eviction selection.

## Migration

- Opening a database at the current schema revision backfills `eventPriority` from
  existing `events` and relationship tables in bounded batches.
- Removed settings keys `cache.maxEvents`, `cache.maxAgeDays`, and
  `cache.compactionEnabled` are ignored after data migration.
