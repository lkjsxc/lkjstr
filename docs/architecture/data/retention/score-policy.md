# Retention Score Policy

## Purpose

Score policy defines how cached events earn priority and which records are
immune from eviction.

## Hard-Protected Classes

These never evict through score compaction:

- Latest kind `0` metadata per pubkey present in cache.
- Latest kind `3` follow list per active account pubkey.
- Pinned event ids from the runtime pin store while their owner is open.
- Notification-critical source events referenced by active notification rows
  when the notification store still depends on them.
- Events with a real product-owned `forceProtected` priority row.

Older kind `0` metadata and older kind `3` follow-list events may receive high
scores, but they are not permanently protected only because of their kind.

## Score Updates

Score combines recency, kind, structural source, and direct target value:

- Recency bucket from event `created_at`.
- Kind weight for metadata, follows, notes, reposts, reactions, and zaps.
- Structural source weight for `e`, `q`, and `p` tags on the event.
- Target bumps for directly referenced `e` and `q` events from replies,
  quotes, reposts, reactions, and zaps.

Runtime visible pins are consulted dynamically during compaction. They are not
persisted as durable `protected` rows.

## Tie Break

When scores tie, prefer the event with the greater `created_at`, then greater
event id lexicographically.

## Initial Score

Newly ingested events receive a baseline score from kind and author presence.
Structural updates add weighted increments defined in the implementation
module.
