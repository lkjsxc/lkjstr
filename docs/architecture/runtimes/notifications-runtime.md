# Notifications Runtime

## Purpose

Notifications runtime owns active-account notification indexing and relay
backfill.

## Contract

- Load local notification records before relying on relay events.
- Background sync and the tab runtime subscribe to supported active-account
  `#p` events: kinds `0`, `1`, `6`, `7`, `16`, and `9735`.
- Store notification source events through the shared repository.
- Resolve target/root event previews from the shared repository for rows that
  reference another event.
- Derive notification records from stored events.
- Keep Notifications source and target preview state to the feed memory window.
- Older pages load local records first, then one bounded relay page when a
  cursor exists.
- Historical relay pages use the oldest loaded event time as `until`.
- Live relay reads set `since` when the runtime starts.
- Mark visible records read only when the Notifications tab is visible and the
  window is focused.
- No active account or no enabled read relays settles loading without opening
  hidden relay connections.
- Use enabled read relays from the selected default relay set.
- Close subscriptions when relay settings change or the tab closes.
