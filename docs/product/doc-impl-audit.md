# Documentation vs Implementation Audit

## Purpose

This matrix tracks contract clauses that are implemented, partial, or
documented-only. Update it when a vertical slice closes a gap.

## Feed Surface

| Clause | Contract | Status | Notes |
| ------ | -------- | ------ | ----- |
| IO near-end sentinel | [feed-surface/near-end.md](../architecture/data/feed-surface/near-end.md) | doc-only | Scroll handlers exist; `nearEndRootMargin` unused |
| Scroll fallback | near-end.md | partial | `isNearEnd` in feed-window |
| 2× viewport margin | near-end.md | doc-only | Code used 1.5× at audit start |
| `feedPagingPhase` footer | [footer-phase.md](../architecture/data/feed-surface/footer-phase.md) | partial | Reducer exists; not wired to UI |
| `FeedSurfaceStatus` all feeds | footer-phase.md | partial | Main feeds yes; Search/Custom Request thin |
| Speculative older | feed-surface.md | partial | Home/Global/Profile/Thread/Notifications |
| Staged row pipeline | [staged-pipeline.md](../architecture/data/feed-surface/staged-pipeline.md) | doc-only | `staged-rows.ts` was passthrough |
| Notifications list mode | [surface-matrix.md](../architecture/data/feed-surface/surface-matrix.md) | partial | Native list, not virtua |

## Tab Continuity

| Clause | Contract | Status | Notes |
| ------ | -------- | ------ | ----- |
| Scroll + virtua anchor | tab-runtime.md | implemented | session + IDB |
| Feed cursors in snapshot | tab-runtime.md, storage.md | doc-only | Schema expansion planned |
| `hasOlder` / `hasNewer` in snapshot | tab-runtime.md | doc-only | |
| Search query in tool snapshot | tabs.md | doc-only | |
| Session cap 32 | tab-runtime.md | doc-only | Was 12 |
| Inactive tab unmount | tab-runtime.md | implemented | |

## Event Actions

| Clause | Contract | Status | Notes |
| ------ | -------- | ------ | ----- |
| `aria-pressed` Heart/Repost | event-actions.md | implemented | |
| Pressed off visible window | event-actions.md | partial | IDB scan limit 800 |
| Persistent action index | storage.md | doc-only | Hybrid index planned |

## Workspace Polish

| Clause | Contract | Status | Notes |
| ------ | -------- | ------ | ----- |
| Tab strip excluded from split | tab-dragging.md | implemented | |
| Scrollbar gutter | scroll-layout.md | implemented | |
| Tile-scoped emoji | tile-overlays.md | implemented | |
| No feed npub subtitle | identity-rendering.md | implemented | feed-identity |
| Welcome document links | welcome.md | implemented | |
