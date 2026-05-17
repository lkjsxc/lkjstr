Owner: Architecture
State: Canon

# Resize

## Role

Resize code converts pointer movement on split handles into layout ratio
changes.

## Contract

- Horizontal split handles use the split container width.
- Vertical split handles use the split container height.
- Pointer delta converts to `deltaPx / max(containerSizePx, 240)`.
- A sensitivity multiplier of `0.45` damps the ratio change.
- Tiny movement is ignored.
- Pointer listeners are cleaned up on pointer up and component unmount.
- Workspace persistence happens after a damped resize update, not from raw
  pixel movement.
- Adjacent split siblings keep minimum ratios and normalized totals.

## Acceptance

- Small tiles resize controllably.
- Large tiles still resize with practical pointer movement.
- Unit tests cover container-size conversion and damping.
