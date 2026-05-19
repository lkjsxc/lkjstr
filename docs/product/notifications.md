# Notifications

## Purpose

The Notifications tab shows relay-backed account activity as an infinite event
tree.

## Contract

- The tab opens from New Tab.
- Records are scoped to the active account pubkey.
- Mentions, replies, reactions, reposts, follows, and quotes are indexed.
- Relay reads use enabled read relays from the selected default relay set.
- Notification events are written through the shared repository.
- Visible notifications are marked read when the tab receives focus.
- Initial loading settles after local records load and subscription setup
  finishes, even when no notification event arrives.
- Partial relay failure stays visible in diagnostics but does not block cached
  or reachable notification records.
- Empty state is explicit when no records exist.
