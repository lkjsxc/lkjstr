# Feed Surface

## Purpose

Feed surface is the shared contract for feed-like tabs: near-end detection,
bottom status, speculative older prefetch, staged row materialization, and list
integration.

## Table of Contents

- [near-end.md](near-end.md): IntersectionObserver sentinel, scroll fallback,
  threshold constants.
- [older-load-mode.md](older-load-mode.md): when `loadOlder` is allowed
  relative to user scroll intent.
- [event-value.md](event-value.md): display bounds, runtime pins, and retention
  value for feed events.
- [footer-phase.md](footer-phase.md): `feedPagingPhase` and `FeedSurfaceStatus`.
- [staged-pipeline.md](staged-pipeline.md): relay page, row shell, enrichment.
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
