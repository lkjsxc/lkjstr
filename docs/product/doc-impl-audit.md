# Documentation vs Implementation Audit

## Purpose

This matrix tracks contract clauses that are implemented, partial, or
documented-only. Update it when a vertical slice closes a gap.

## Feed Surface

| Clause                        | Contract                                                                   | Status      | Notes                                          |
| ----------------------------- | -------------------------------------------------------------------------- | ----------- | ---------------------------------------------- |
| IO near-end sentinel          | [feed-surface/near-end.md](../architecture/data/feed-surface/near-end.md)  | implemented | `near-end-observer.ts`, `EventTreeListNearEnd` |
| Scroll fallback               | near-end.md                                                                | implemented | `isNearEnd` in feed-window                     |
| 2x viewport margin            | near-end.md                                                                | implemented | `nearEndThreshold` uses `viewport * 2`         |
| `feedPagingPhase` footer      | [footer-phase.md](../architecture/data/feed-surface/footer-phase.md)       | implemented | `footer-phase.ts`, `FeedSurfaceStatus`         |
| `FeedSurfaceStatus` all feeds | footer-phase.md                                                            | implemented | Including Notifications native list            |
| Speculative older             | feed-surface.md                                                            | implemented | Search uses coordinator                        |
| Staged row pipeline           | [staged-pipeline.md](../architecture/data/feed-surface/staged-pipeline.md) | implemented | Home/Global/Profile/Thread                     |
| Notifications list mode       | [surface-matrix.md](../architecture/data/feed-surface/surface-matrix.md)   | implemented | Native list, shared footer                     |

## Tab Continuity

| Clause                              | Contract                   | Status      | Notes                   |
| ----------------------------------- | -------------------------- | ----------- | ----------------------- |
| Scroll + virtua anchor              | tab-runtime.md             | implemented | session + IDB           |
| Feed cursors in snapshot            | tab-runtime.md, storage.md | implemented | `tab-runtime-registry`  |
| `hasOlder` / `hasNewer` in snapshot | tab-runtime.md             | implemented | runtime snapshot        |
| Search query in tool snapshot       | tabs.md                    | implemented | Search tab fields       |
| Session cap 32                      | tab-runtime.md             | implemented | `session-tab-snapshots` |
| Inactive tab unmount                | tab-runtime.md             | implemented |                         |

## Event Actions

| Clause                      | Contract         | Status      | Notes                   |
| --------------------------- | ---------------- | ----------- | ----------------------- |
| `aria-pressed` Heart/Repost | event-actions.md | implemented |                         |
| Pressed off visible window  | event-actions.md | implemented | `action-state-index.ts` |
| Persistent action index     | storage.md       | implemented | hybrid with feed merge  |

## Workspace Polish

| Clause                        | Contract              | Status      | Notes         |
| ----------------------------- | --------------------- | ----------- | ------------- |
| Tab strip excluded from split | tab-dragging.md       | implemented |               |
| Scrollbar gutter              | scroll-layout.md      | implemented |               |
| Tile-scoped emoji             | tile-overlays.md      | implemented |               |
| No feed npub subtitle         | identity-rendering.md | implemented | feed-identity |
| Welcome document links        | welcome.md            | implemented |               |
