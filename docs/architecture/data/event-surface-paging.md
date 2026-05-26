# Event Surface Paging

## Purpose

Short index for near-end and footer constants. Canonical detail lives in
[feed-surface/](feed-surface/README.md).

## Constants

- `nearEndPixels = 1200`
- Effective threshold: `max(nearEndPixels, viewportHeight * 2)`
- Default page size: `30` (see [feed-memory.md](feed-memory.md))

## Surfaces

See [feed-surface/surface-matrix.md](feed-surface/surface-matrix.md).

## Bottom Status

See [feed-surface/footer-phase.md](feed-surface/footer-phase.md).

## Tab Restoration

Feed tabs capture anchor event id, offset, and feed cursors on blur. Session
snapshots restore within `tabs.inactiveRetentionSeconds`. IndexedDB `tabStates`
restores across reload. See [../workspace/tab-runtime.md](../workspace/tab-runtime.md).
