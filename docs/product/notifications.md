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
- Empty state is explicit when no records exist.
