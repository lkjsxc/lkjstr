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
| Hidden-mount inactive tab bodies    | tab-body-mount.md          | implemented | `PaneTabStack`, paused runtimes |
| DOM-first scroll on tab return      | tab-retention-flow.md      | implemented | `hasTracked` in focus sync      |

## Event Actions

| Clause                      | Contract         | Status      | Notes                   |
| --------------------------- | ---------------- | ----------- | ----------------------- |
| `aria-pressed` Heart/Repost | event-actions.md | implemented |                         |
| Pressed off visible window  | event-actions.md | implemented | `action-state-index.ts` |
| Persistent action index     | storage.md       | implemented | hybrid with feed merge  |

## Workspace Polish

| Clause                                | Contract              | Status      | Notes                            |
| ------------------------------------- | --------------------- | ----------- | -------------------------------- |
| Pane chrome excluded from edge splits | pane-chrome-scope.md  | implemented | `chromeBottom` from `.pane-head` |
| Center preview body only              | pane-drop-target.md   | implemented | all zones use `bodyOffsetTop`    |
| Edge preview body offset              | pane-drop-target.md   | implemented | `bodyOffsetTop` on drop layer    |
| Tab drag selection arming             | tab-strip-gestures.md | implemented | `tab-strip-drag-arming` class    |
| Scroll owner retention                | tab-retention-flow.md | implemented | `data-scroll-owner`, scrollTop=0 |
| Feed scroll gutter on viewport        | scroll-layout.md      | implemented | `.event-list__viewport` + token  |
| Tab strip excluded from split         | pane-chrome-scope.md  | implemented | chromeBottom from `.pane-head`   |
| Scrollbar at tile edge                | scroll-layout.md      | implemented | `--scroll-track-edge`, pane body |
| Tile-scoped emoji                     | tile-overlays.md      | implemented |                                  |
| No feed npub subtitle                 | identity-rendering.md | implemented | feed-identity                    |
| Welcome document links                | welcome.md            | implemented |                                  |

## Feed Scroll and Row Chrome

| Clause                                | Contract              | Status | Notes |
| ------------------------------------- | --------------------- | ------ | ----- |
| Single notification separator         | feed-row-chrome.md    | open   | list-owned border |
| Single Notifications scroll owner     | feed-scroll-surface.md | open  | `.feed-tab` + one `[data-scroll-owner]` |
| Event More clears scrollbar track       | scroll-layout.md      | open   | inset on `.event-main` and `.event-more` |
| No horizontal overflow on scroll owner  | scroll-surface-audit.md | open | e2e on `[data-scroll-owner]` |
| Notifications on FeedScrollSurface      | feed-scroll-surface.md | open  | Virtua flat list |
| Pane.svelte at or below 200 lines       | repository standards  | open   | extract PaneHead if needed |
