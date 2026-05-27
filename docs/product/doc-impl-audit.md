# Documentation vs Implementation Audit

## Purpose

This matrix tracks contract clauses that are implemented, partial, or
documented-only. Update it when a vertical slice closes a gap.

## Feed Surface

| Clause                        | Contract                                                                   | Status      | Notes                                                   |
| ----------------------------- | -------------------------------------------------------------------------- | ----------- | ------------------------------------------------------- |
| IO near-end sentinel          | [feed-surface/near-end.md](../architecture/data/feed-surface/near-end.md)  | implemented | `near-end-observer.ts`, `EventTreeListNearEnd`          |
| Scroll fallback               | near-end.md                                                                | implemented | `isNearEnd` in feed-window                              |
| 2x viewport margin            | near-end.md                                                                | implemented | `nearEndThreshold` uses `viewport * 2`                  |
| `feedPagingPhase` footer      | [footer-phase.md](../architecture/data/feed-surface/footer-phase.md)       | implemented | `footer-phase.ts`, `FeedSurfaceStatus`                  |
| `FeedSurfaceStatus` all feeds | footer-phase.md                                                            | implemented | Including Notifications native list                     |
| Speculative older             | feed-surface.md                                                            | implemented | Search uses coordinator                                 |
| Staged row pipeline           | [staged-pipeline.md](../architecture/data/feed-surface/staged-pipeline.md) | implemented | Home/Global/Profile/Thread                              |
| Notifications list mode       | [surface-matrix.md](../architecture/data/feed-surface/surface-matrix.md)   | implemented | Virtua flat list via `FeedScrollSurface`, shared footer |

## Tab Continuity

| Clause                              | Contract                   | Status      | Notes                           |
| ----------------------------------- | -------------------------- | ----------- | ------------------------------- |
| Scroll + virtua anchor              | tab-runtime.md             | implemented | session + IDB                   |
| Feed cursors in snapshot            | tab-runtime.md, storage.md | implemented | `tab-runtime-registry`          |
| `hasOlder` / `hasNewer` in snapshot | tab-runtime.md             | implemented | runtime snapshot                |
| Search query in tool snapshot       | tabs.md                    | implemented | Search tab fields               |
| Session cap 32                      | tab-runtime.md             | implemented | `session-tab-snapshots`         |
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

## Subscription Orchestration

| Clause                        | Contract                    | Status      | Notes                           |
| ----------------------------- | --------------------------- | ----------- | ------------------------------- |
| Demand / Lease docs           | subscription-orchestration/ | implemented | `src/lib/relays/orchestration/` |
| Bootstrap closes on EOSE      | bootstrap-live.md           | implemented | relay client backward strategy  |
| Shared live lease across tabs | compatibility.md            | implemented | fingerprint + channel merge     |
| Stats orchestration counters  | observability.md            | implemented | metrics + RuntimeMemoryPanel    |
| Subscription E2E gate         | verification.md             | implemented | lease-sharing, pane-churn specs |
| Hidden tab demand pause       | demand.md                   | implemented | setVisibility on feed runtimes  |

## Feed Correctness

| Clause                                                | Contract                             | Status      | Notes                                                                                                                                                      |
| ----------------------------------------------------- | ------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical event ordering                              | feeds/invariants/event-ordering.md   | implemented | `event-order.ts`                                                                                                                                           |
| Merge-by-id reducer                                   | feeds/runtime/merge-reducer.md       | implemented | `timeline-reducer.ts`                                                                                                                                      |
| Home no self-only fallback                            | feeds/sources/home.md                | implemented | Follow-list absence is follow-sub/scoped and never triggered from unrelated `EOSE`.                                                                        |
| Notification `#p` filters                             | feeds/sources/notifications.md       | implemented | `notification-filters.ts`                                                                                                                                  |
| Notifications bounded initial and older relay windows | feeds/sources/notifications.md       | implemented | Initial read includes `(since, until)`; older pages are bounded and based on notification record `createdAt`, with older-load gated by user scroll intent. |
| Home live note subscription includes startup `since`  | feeds/runtime                        | implemented | Live `authorFilters` include startup-bounded `since` to keep initial live inserts protocol-bounded.                                                        |
| Follow-list absence ownership is follow-sub only      | feeds/sources/home.md                | implemented | No-follow-list waits for follow-list kind `3` completion across intended relays (follow-sub EOSE ownership only).                                          |
| Per-tab page cursors                                  | feeds/runtime/per-runtime-cursors.md | implemented | runtime instance key                                                                                                                                       |
| Timeline regression e2e                               | verification.md                      | implemented | Includes Home follow-discovery EOSE ownership and Notifications bounded older paging / no auto-backfill scenarios.                                         |
| Multi-tab cursor e2e                                  | feeds/runtime/multi-tab-ownership.md | partial     | Will be re-verified after cursor-key and older-window changes.                                                                                             |

## Feed Scroll and Row Chrome

| Clause                                 | Contract                | Status      | Notes                                                                                                          |
| -------------------------------------- | ----------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| Single notification separator          | feed-row-chrome.md      | implemented | list-owned separator on `.notification-row`; embedded `EventRow` suppresses its separator                      |
| Single Notifications scroll owner      | feed-scroll-surface.md  | implemented | `.feed-tab` uses `overflow: hidden` and exactly one `[data-scroll-owner]` owns vertical scroll                 |
| Event More clears scrollbar track      | scroll-layout.md        | implemented | `.event-more` uses `right: var(--scroll-content-inset)` and `.event-main` reserves the same inline-end padding |
| No horizontal overflow on scroll owner | scroll-surface-audit.md | implemented | e2e `assertNoHorizontalOverflow` checks scroll owners and `.event-list__viewport`                              |
| Notifications on FeedScrollSurface     | feed-scroll-surface.md  | implemented | Notifications use Virtua via `FeedScrollSurface` and the shared footer/near-end semantics                      |
| Pane.svelte at or below 200 lines      | repository standards    | implemented | Pane header moved to `PaneHead.svelte` to keep the file within the cap                                         |
