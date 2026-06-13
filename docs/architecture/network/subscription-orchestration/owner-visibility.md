# Owner Visibility

## Purpose

Describe how tab visibility affects live leases without breaking cached feed
windows.

Status: Rust owns pure visibility transitions from owner state to host effects.
TypeScript still calls the current product visibility handlers.

## Rules

- `visibility: visible` keeps live leases attached when the owner is the last
  visible holder of that fingerprint.
- `visibility: hidden` releases live wire traffic for that owner; refcount remains
  until `releaseOwner`.
- Rust feed runtime release removes the owner demand while keeping the bounded
  feed window and cursors outside the lease registry.
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
