# Notifications Runtime

## Purpose

Notifications runtime owns active-account notification indexing and relay
backfill.

## Contract

- Load local notification records before relying on relay events.
- Subscribe to live mentions, replies, reactions, reposts, quotes, and profile
  references for the active account.
- Store notification source events through the shared repository.
- Derive notification records from stored events.
- Keep Notifications to a `180` item in-memory window.
- Older pages load local records first, then one bounded relay page when a
  cursor exists.
- Historical relay pages use the oldest loaded event time as `until`.
- Live relay reads set `since` when the runtime starts.
- Mark visible records read when the tab receives focus.
- No active account or no enabled read relays settles loading without opening
  hidden relay connections.
- Use enabled read relays from the selected default relay set.
- Close subscriptions when relay settings change or the tab closes.
