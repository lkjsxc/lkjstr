# Stats Tab

## Purpose

Stats shows current-session network and cache counters.

## Contract

- Stats opens from New Tab as `network-stats`.
- It reads relay snapshots, cache status, job health, and runtime memory
  counters.
- It labels active subscriptions by redacted purpose instead of exposing opaque
  ids as the primary row text.
- `subscription-rows.ts` maps relay snapshots into Stats table rows.
- It never creates relay subscriptions.
- Manual refresh is always available.
- Optional auto-refresh polls every two seconds while enabled.
