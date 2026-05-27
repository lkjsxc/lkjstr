# Cache Budget

## Purpose

Define the local cache soft byte budget.

## Contract

- `cache.maxBytes` defaults to `268435456` bytes.
- The setting is a soft budget for durable event cache pressure, not a hard
  quota or a fixed event-count limit.
- Compaction may start when current usage exceeds the lower of browser quota
  pressure and `cache.maxBytes`.
- Scheduled compaction is bounded and triggered from event writes after a write
  count threshold.
- Compaction preserves protected records, latest profile metadata, current
  account follow lists, pins, settings, relay sets, workspace state,
  notifications, and Tweet drafts.
- Compaction stops cleanly when no event candidates remain.
