# Documentation vs Implementation Audit

## Purpose

This matrix tracks contract clauses that are implemented, partial, or
documented-only. Update it when a vertical slice closes a gap.

## Evidence Rule

Each implemented row should name the owning contract and the source or test
surface that proves it. Bare filenames below are source anchors; contract
references should stay as relative Markdown links.

## Rust WASM Target

| Clause                                      | Contract                                                                 | Status        | Notes                         |
| ------------------------------------------- | ------------------------------------------------------------------------ | ------------- | ----------------------------- |
| Rust/WASM client ownership                  | [rust-wasm-client.md](../decisions/rust-wasm-client.md)                  | partial       | protocol bridge exists        |
| Rust/WASM architecture subtree              | [rust-wasm/README.md](../architecture/rust-wasm/README.md)               | partial       | protocol bridge implemented   |
| Rust workspace checks                       | [crate-boundaries.md](../architecture/rust-wasm/crate-boundaries.md)     | implemented   | `lkjstr-xtask` commands       |
| Rust protocol event validation              | [protocol-kernel.md](../architecture/rust-wasm/protocol-kernel.md)       | implemented   | byte, event, policy, ID tests |
| Rust protocol filters and relay messages    | [protocol-kernel.md](../architecture/rust-wasm/protocol-kernel.md)       | implemented   | filter and message tests      |
| Rust protocol signing and verification      | [protocol-kernel.md](../architecture/rust-wasm/protocol-kernel.md)       | implemented   | crypto and verify tests       |
| Rust protocol NIP-19 entities               | [protocol-kernel.md](../architecture/rust-wasm/protocol-kernel.md)       | implemented   | NIP-19 Rust tests             |
| Rust protocol relay URL normalization        | [protocol-kernel.md](../architecture/rust-wasm/protocol-kernel.md)       | implemented   | relay URL Rust tests          |
| Rust protocol emoji and warnings            | [protocol-kernel.md](../architecture/rust-wasm/protocol-kernel.md)       | implemented   | NIP-30 and NIP-36 Rust tests  |
| Rust protocol tag and action helpers         | [protocol-kernel.md](../architecture/rust-wasm/protocol-kernel.md)       | implemented   | tag, reaction, builder tests  |
| Rust protocol emoji source helpers           | [protocol-kernel.md](../architecture/rust-wasm/protocol-kernel.md)       | implemented   | NIP-51 Rust tests             |
| Rust protocol zaps and upload auth          | [protocol-kernel.md](../architecture/rust-wasm/protocol-kernel.md)       | implemented   | NIP-57, NIP-96, NIP-98 tests  |
| Rust protocol relay list metadata            | [protocol-kernel.md](../architecture/rust-wasm/protocol-kernel.md)       | implemented   | NIP-65 Rust tests             |
| Rust protocol WASM bridge                   | [host-boundary.md](../architecture/rust-wasm/host-boundary.md)           | implemented   | browser WASM tests            |
| Rust pure account domain                    | [app-boundary.md](../architecture/rust-wasm/app-boundary.md)             | implemented   | domain account tests          |
| Rust workspace model basics                 | [app-boundary.md](../architecture/rust-wasm/app-boundary.md)             | implemented   | domain workspace tests        |
| Rust workspace snapshot payloads            | [app-boundary.md](../architecture/rust-wasm/app-boundary.md)             | implemented   | domain snapshot tests         |
| Rust storage manifest and outcomes          | [storage-kernel.md](../architecture/rust-wasm/storage-kernel.md)         | implemented   | storage crate tests            |
| Rust tab-state storage contract             | [storage-kernel.md](../architecture/rust-wasm/storage-kernel.md)         | implemented   | tab-state storage tests        |
| Rust storage repositories and IndexedDB      | [storage-kernel.md](../architecture/rust-wasm/storage-kernel.md)         | not implemented | current runtime remains TS    |
| Rust relay state machine basics             | [relay-runtime.md](../architecture/rust-wasm/relay-runtime.md)           | implemented   | relay crate tests              |
| Rust relay client and browser adapters       | [relay-runtime.md](../architecture/rust-wasm/relay-runtime.md)           | not implemented | current runtime remains TS    |
| Rust app, UI, and snapshot persistence       | [crate-boundaries.md](../architecture/rust-wasm/crate-boundaries.md)     | not implemented | current runtime remains TS    |
| Docker Rust/WASM verification               | [verification.md](../architecture/rust-wasm/verification.md)             | design-only   | commands documented target    |

## Feed Surface

| Clause                        | Contract                                                                   | Status      | Notes                                                   |
| ----------------------------- | -------------------------------------------------------------------------- | ----------- | ------------------------------------------------------- |
| IO near-end sentinel          | [feed-surface/near-end.md](../architecture/data/feed-surface/near-end.md)  | implemented | `near-end-observer.ts`, `EventTreeListNearEnd`          |
| Scroll fallback               | [near-end.md](../architecture/data/feed-surface/near-end.md)               | implemented | `isNearEnd` in feed-window                              |
| 2x viewport margin            | near-end.md                                                                | implemented | `nearEndThreshold` uses `viewport * 2`                  |
| `feedPagingPhase` footer      | [footer-phase.md](../architecture/data/feed-surface/footer-phase.md)       | implemented | `footer-phase.ts`, `FeedSurfaceStatus`                  |
| `FeedSurfaceStatus` all feeds | footer-phase.md                                                            | implemented | Including Notifications native list                     |
| Speculative older             | [feed-surface.md](../architecture/data/feed-surface.md)                    | implemented | Search uses coordinator                                 |
| Staged row pipeline           | [staged-pipeline.md](../architecture/data/feed-surface/staged-pipeline.md) | implemented | Home/Global/Profile/Thread                              |
| Notifications list mode       | [surface-matrix.md](../architecture/data/feed-surface/surface-matrix.md)   | implemented | Virtua flat list via `FeedScrollSurface`, shared footer |

## Tab Continuity

| Clause                              | Contract                                                                                                                                   | Status      | Notes                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------------------------------- |
| Scroll + virtua anchor              | [tab-runtime.md](../architecture/workspace/tab-runtime.md)                                                                                 | implemented | session + IDB                   |
| Feed cursors in snapshot            | [tab-runtime.md](../architecture/workspace/tab-runtime.md), [tab-snapshots.md](../architecture/data/storage/data-classes/tab-snapshots.md) | implemented | `tab-runtime-registry`          |
| `hasOlder` / `hasNewer` in snapshot | [tab-runtime.md](../architecture/workspace/tab-runtime.md)                                                                                 | implemented | runtime snapshot                |
| Search query in tool snapshot       | [tabs.md](workspace/tabs.md)                                                                                                               | implemented | Search tab fields               |
| Session cap 32                      | [tab-runtime.md](../architecture/workspace/tab-runtime.md)                                                                                 | implemented | `session-tab-snapshots`         |
| Hidden-mount inactive tab bodies    | [tab-body-mount.md](../architecture/workspace/tab-body-mount.md)                                                                           | implemented | `PaneTabStack`, paused runtimes |
| DOM-first scroll on tab return      | [tab-retention-flow.md](../architecture/workspace/tab-retention-flow.md)                                                                   | implemented | `hasTracked` in focus sync      |

## Event Actions

| Clause                      | Contract          | Status      | Notes                   |
| --------------------------- | ----------------- | ----------- | ----------------------- |
| `aria-pressed` Heart/Repost | event-actions.md  | implemented |                         |
| Pressed off visible window  | event-actions.md  | implemented | `action-state-index.ts` |
| Persistent action index     | storage/README.md | implemented | hybrid with feed merge  |

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

| Clause                         | Contract                                                                                              | Status      | Notes                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| Intent-only orchestration docs | [subscription-orchestration/README.md](../architecture/network/subscription-orchestration/README.md)  | implemented | demand-intent, lease-key, page-read-dedupe                                                          |
| Wire-equivalent lease keys     | [lease-key.md](../architecture/network/subscription-orchestration/lease-key.md)                       | implemented | `lease-key.ts`                                                                                      |
| Semantic page read dedupe      | [page-read-dedupe.md](../architecture/network/subscription-orchestration/page-read-dedupe.md)         | implemented | `readPageByIntent`, `pageIntentSemanticKey`, page-read tests                                        |
| Shared live lease across tabs  | [compatibility.md](../architecture/network/subscription-orchestration/compatibility.md)               | implemented | fingerprint + channel merge                                                                         |
| Stats orchestration counters   | [metrics.md](../architecture/network/subscription-orchestration/metrics.md)                           | implemented | metrics + RuntimeMemoryPanel                                                                        |
| Subscription E2E gate          | [tests.md](../architecture/network/subscription-orchestration/tests.md)                               | implemented | `subscription-three-home.spec.ts` + visibility churn                                                |
| Hidden tab demand pause        | [owner-visibility.md](../architecture/network/subscription-orchestration/owner-visibility.md)         | implemented | setVisibility on feed runtimes                                                                      |
| All surfaces on intent API     | [orchestration-bridge.md](../architecture/feeds/orchestration-bridge.md)                              | implemented | Home/Profile route-fingerprinted reads, selected tools, and direct exact-read exceptions documented |
| Shared Home backend query      | [home-query-lifecycle.md](../architecture/backend/home-query-lifecycle.md)                            | implemented | `attachHomeQuery`, shared key excludes tab id                                                       |
| Feed route isolation           | [feed-route-isolation.md](../architecture/network/subscription-orchestration/feed-route-isolation.md) | implemented | Unit and browser gates cover Home/Profile route keys, live replacement, Notifications isolation     |

## Request Budgeting

| Clause                     | Contract                                                                                         | Status      | Notes                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ----------- | ---------------------------------------------------- |
| Budget contract subtree    | [request-budget/README.md](../architecture/network/request-budget/README.md)                     | implemented | request-budget source modules and unit tests         |
| Typed NIP-11 limitations   | [request-budget/nip11.md](../architecture/network/request-budget/nip11.md)                       | implemented | `relay-info-parse.ts`, `relay-info.test.ts`          |
| Effective per-relay limits | [request-budget/effective-limits.md](../architecture/network/request-budget/effective-limits.md) | implemented | `relay-page-limits.ts`, `relay-page-limits.test.ts`  |
| Request-size rejection     | [request-budget/message-size.md](../architecture/network/request-budget/message-size.md)         | implemented | `relay-client.ts`, request-budget message-size tests |
| UI diagnostics             | [tools/relay-management.md](tools/relay-management.md), [tools/stats.md](tools/stats.md)         | implemented | `RelayInfoDetails.svelte`, `NetworkStatsTab.svelte`  |

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
| Home shared page cursors                              | backend/home-query-lifecycle.md      | implemented | Shared Home query owns cursors; non-Home runtime cursors remain per tab.                                                                                   |
| Timeline regression e2e                               | verification.md                      | implemented | Includes Home follow-discovery EOSE ownership and Notifications bounded viewport-fill older paging.                                                        |
| Multi-tab Home ownership                              | feeds/runtime/multi-tab-ownership.md | implemented | Matching Home tabs attach to one backend query and share bootstrap, live leases, and cursors.                                                              |
| Cache-first interval proof                            | data/cache-first-feed-pages.md       | implemented | Interval-union proof and partial relay pruning are covered by unit cache scan tests.                                                                       |
| Warm grouped scan hints                               | data/storage/README.md               | implemented | Hint policy and warm-start scan tests prove conservative relay-span tuning without suppressing reads.                                                      |

## Feed Scroll and Row Chrome

| Clause                                 | Contract                | Status      | Notes                                                                                                          |
| -------------------------------------- | ----------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| Single notification separator          | feed-row-chrome.md      | implemented | list-owned separator on `.notification-row`; embedded `EventRow` suppresses its separator                      |
| Single Notifications scroll owner      | feed-scroll-surface.md  | implemented | `.feed-tab` uses `overflow: hidden` and exactly one `[data-scroll-owner]` owns vertical scroll                 |
| Event More clears scrollbar track      | scroll-layout.md        | implemented | `.event-more` uses `right: var(--scroll-content-inset)` and `.event-main` reserves the same inline-end padding |
| No horizontal overflow on scroll owner | scroll-surface-audit.md | implemented | e2e `assertNoHorizontalOverflow` checks scroll owners and `.event-list__viewport`                              |
| Notifications on FeedScrollSurface     | feed-scroll-surface.md  | implemented | Notifications use Virtua via `FeedScrollSurface` and the shared footer/near-end semantics                      |
| Profile in-flow summary rows           | profiles.md             | implemented | `ProfileHeader`, status, load-newer, empty, note, and footer rows share one `EventTreeList` scroll owner       |
| Pane.svelte at or below 200 lines      | repository standards    | implemented | Pane header moved to `PaneHead.svelte` to keep the file within the cap                                         |
