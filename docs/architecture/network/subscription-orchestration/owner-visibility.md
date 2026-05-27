# Owner Visibility

## Purpose

Describe how tab visibility affects live leases without breaking cached feed
windows.

## Rules

- `visibility: visible` keeps live leases attached when the owner is the last
  visible holder of that fingerprint.
- `visibility: hidden` releases live wire traffic for that owner; refcount remains
  until `releaseOwner`.
- Cached items, cursors, and scroll anchors stay in the runtime until tab close.

## Pane churn

Closing all panes must drive orchestration gauges to zero:

- `activeDemands`
- `activeLeases`
- `liveLeases`

See operations memory verification.

## Related

- [demand-intent.md](demand-intent.md)
- [live-lease.md](live-lease.md)
