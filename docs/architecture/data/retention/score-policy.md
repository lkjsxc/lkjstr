# Retention Score Policy

## Purpose

Score policy defines how cached events earn priority and which records are
immune from eviction.

## Hard-Protected Classes

These never evict through score compaction:

- Latest kind `0` metadata per pubkey present in cache.
- Latest kind `3` follow list per active account pubkey.
- Pinned event ids from the pin store.
- Notification-critical source events referenced by active notification rows
  when the notification store still depends on them.

## Score Updates

Score increases only when structural relationships arrive:

- Reply edges (`e` parent tags).
- Quote and repost relationships.
- Reaction and zap references to the event.
- Notification records referencing the event.
- New participation in visible graph context for loaded feeds.

Score does not decrease over time. There is no background decay loop.

## Tie Break

When scores tie, prefer the event with the greater `created_at`, then greater
event id lexicographically.

## Initial Score

Newly ingested events receive a baseline score from kind and author presence.
Structural updates add weighted increments defined in the implementation
module.
