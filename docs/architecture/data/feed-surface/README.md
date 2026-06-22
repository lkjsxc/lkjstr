# Feed Surface

## Purpose

Feed surface is the shared contract for feed-like tabs: scroll ownership,
near-end detection, footer status, speculative older prefetch, row
materialization, geometry, and real-data level of detail.

## Table of Contents

- [near-end.md](near-end.md): IntersectionObserver sentinel, scroll fallback,
  threshold constants.
- [older-load-mode.md](older-load-mode.md): when `loadOlder` is allowed
  relative to user scroll intent.
- [event-value.md](event-value.md): display bounds, runtime pins, and retention
  value for feed events.
- [footer-phase.md](footer-phase.md): `feedPagingPhase` and `FeedSurfaceStatus`.
- [staged-pipeline.md](staged-pipeline.md): relay pages, row planning, enrichment.
- [height-reservation.md](height-reservation.md): shipped reservation loop and
  concise summary of row-height contracts.
- [unload-height-stability.md](unload-height-stability.md): unload,
  dematerialization, shells, and preserved reserved height.
- [enrichment-height-tiers.md](enrichment-height-tiers.md): structural vs
  enrichment collapse on dematerialization.
- [geometry-model.md](geometry-model.md): durable geometry keys, estimates,
  measurements, reservations, and anchor compensation.
- [repost-rendering.md](repost-rendering.md): shared event renderer contract for
  repost targets and contextual chrome.
- [long-content.md](long-content.md): real visual fragments for oversized event
  content without nested scroll.
- [scroll-regression-tests.md](scroll-regression-tests.md): host-boundary and
  reducer tests for scroll correctness.
- [lod-tree.md](lod-tree.md): real-data level-of-detail tree for heavy feeds.
- [surface-matrix.md](surface-matrix.md): per-tab list mode and paging.
- [feed-scroll-surface.md](feed-scroll-surface.md): shared scroll shell and
  `data-scroll-owner`.
- [feed-row-chrome.md](feed-row-chrome.md): list-owned separators and embedded
  rows.

## Related

- [../event-surface-paging.md](../event-surface-paging.md): short index to this
  tree.
- [../feed-memory.md](../feed-memory.md): window sizes and durable cache.
- [../../workspace/tab-runtime.md](../../workspace/tab-runtime.md): tab restore.
- [../../orchestration/README.md](../../orchestration/README.md): app decision
  memory.

## All Files

```text
`enrichment-height-tiers.md` `event-value.md` `feed-row-chrome.md` `feed-scroll-surface.md` `footer-phase.md` `geometry-model-keys.md` `geometry-model-persistence.md`
`geometry-model.md` `height-reservation.md` `lod-tree.md` `long-content.md` `near-end.md` `older-load-mode.md` `repost-rendering.md`
`scroll-regression-tests.md` `staged-pipeline.md` `surface-matrix.md` `unload-height-stability.md`
```
