# Retention Compaction

## Purpose

Retention compaction removes lowest-priority cached events while preserving
hard-protected records and dependent rows.

## Contract

- Compaction runs on a schedule and after large ingest bursts.
- Selection uses the `eventPriority` score index ascending. No
  `events.orderBy('created_at').each` full scan.
- Each batch removes event rows, relay receipts, tag rows, and feed cursors that
  reference pruned ids.
- Accounts, settings, relay sets, workspace layout, notifications, and Tweet
  drafts are never pruned by event compaction.
- `cacheMeta` records last compaction counts and timestamps for Stats.

## Target Size

- The implementation keeps total cached events near a fixed internal budget
  derived from memory guidance, not user settings.
- When over budget, evict lowest scores until under budget or only protected
  rows remain.

## Settings Removal

- `cache.maxEvents`, `cache.maxAgeDays`, and `cache.compactionEnabled` are
  removed from the settings schema and UI.
- Importing legacy settings ignores those keys.
