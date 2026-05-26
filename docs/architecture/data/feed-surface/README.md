# Feed Surface

## Purpose

Feed surface is the shared contract for feed-like tabs: near-end detection,
bottom status, speculative older prefetch, staged row materialization, and list
integration.

## Documents

- [near-end.md](near-end.md): IntersectionObserver sentinel, scroll fallback,
  threshold constants.
- [footer-phase.md](footer-phase.md): `feedPagingPhase` and `FeedSurfaceStatus`.
- [staged-pipeline.md](staged-pipeline.md): relay page, row shell, enrichment.
- [surface-matrix.md](surface-matrix.md): per-tab list mode and paging.

## Related

- [../event-surface-paging.md](../event-surface-paging.md): short index to this
  tree.
- [../feed-memory.md](../feed-memory.md): window sizes and durable cache.
- [../../workspace/tab-runtime.md](../../workspace/tab-runtime.md): tab restore.
