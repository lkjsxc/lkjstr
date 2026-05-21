# Stats Tab

## Purpose

Stats shows current-session network and cache counters.

## Contract

- Stats opens from New Tab as `network-stats`.
- It reads relay snapshots and cache status only.
- It never creates relay subscriptions.
- Manual refresh is always available.
- Optional auto-refresh polls every two seconds while enabled.
