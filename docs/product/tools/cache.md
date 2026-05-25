# Cache

## Purpose

Cache docs define local event status and automatic pruning behavior. Cache is
not a New Tab surface; diagnostics appear in Stats.

## Contract

- Compaction prunes cached events by lowest retention score using the indexed
  `eventPriority` store. See
  [retention/compaction.md](../../architecture/data/retention/compaction.md).
- Users do not configure event count, age, or compaction enablement in
  Settings.
- Event pruning removes relay receipts, tag rows, and feed cursors only when
  they reference pruned event data.
- Accounts, settings, relay sets, workspace state, and notifications are
  protected from event cache pruning.
