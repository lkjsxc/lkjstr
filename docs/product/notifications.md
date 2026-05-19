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
- Initial and older pages request `30` records.
- Notification tabs keep a `180` item window.
- Older notifications load only after scrolling near the bottom.
- Historical relay pages use `until` from the oldest loaded notification
  event.
- Live relay reads set `since` when the notification runtime starts.
- Visible notifications are marked read when the tab receives focus.
- Initial loading settles after local records load and subscription setup
  finishes, even when no notification event arrives.
- Partial relay failure stays visible in diagnostics but does not block cached
  or reachable notification records.
- Empty state is explicit when no records exist.
- A compact jump to latest action appears when the window prunes newer items.
