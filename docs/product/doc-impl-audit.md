# Documentation vs Implementation Audit

## Purpose

This matrix tracks contract clauses that are implemented, partial, or
documented-only. Update it when a vertical slice closes a gap.

## Evidence Rule

Each implemented row should name the owning contract and the source or test
surface that proves it. Bare filenames below are source anchors; contract
references should stay as relative Markdown links.

Partial and not implemented rows use the executable detail ledgers in
[audit/README.md](audit/README.md). Those ledgers name the next source paths and
closing gates so this concise matrix stays readable.

## Rust WASM Target

Detailed Rust/WASM audit rows live in
[audit/rust-wasm-target.md](audit/rust-wasm-target.md). Keep this file concise
and use the detail file for path-heavy partial rows.

## Storage Cutover

| Clause                        | Contract                                                                   | Status      | Notes                                                                                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SQLite cache-ledger repair    | [repair.md](../architecture/data/storage/retention/repair.md)              | implemented | `cache-ledger-repair-sqlite.ts`, `cache-ledger-target-sqlite.ts`, `schema-gap.test.ts`, and `sqlite-opfs-cache-ledger-repair.test.ts` prove chunked conservative repair. |
| SQLite physical inventory     | [inventory.md](../architecture/data/storage/diagnostics/inventory.md)      | implemented | `storage-inventory.ts` uses worker table counts, old IndexedDB presence diagnostics, localStorage, Cache Storage, and residual overhead without old row scans.           |
| SQLite cache tool summary     | [worker-protocol.md](../architecture/data/sqlite-opfs/worker-protocol.md)  | implemented | Repair health and Stats summary use SQLite-ledger data plus physical inventory rows.                                                                                     |
| Durable redacted app log      | [log.md](tools/log.md)                                                     | implemented | `app-log-repository.ts`, `app-log.test.ts`, and `sqlite-opfs-app-log.test.ts` prove redaction, append, list, clear, and bounded retention wiring.                        |
| Old browser database deletion | [deletion-ledger.md](../architecture/rust-wasm/cutover/deletion-ledger.md) | implemented | Product imports use SQLite repositories; package metadata and old binding files are removed.                                                                             |

## Feed Surface

| Clause                        | Contract                                                                   | Status      | Notes                                                   |
| ----------------------------- | -------------------------------------------------------------------------- | ----------- | ------------------------------------------------------- |
| IO near-end sentinel          | [feed-surface/near-end.md](../architecture/data/feed-surface/near-end.md)  | implemented | `EventTreeListNearEnd` owns observer lifecycle          |
| Scroll fallback               | [near-end.md](../architecture/data/feed-surface/near-end.md)               | implemented | `isNearEnd` in feed-window                              |
| 2x viewport margin            | near-end.md                                                                | implemented | `nearEndThreshold` uses `viewport * 2`                  |
| `feedPagingPhase` footer      | [footer-phase.md](../architecture/data/feed-surface/footer-phase.md)       | implemented | `footer-phase.ts`, `FeedSurfaceStatus`                  |
| `FeedSurfaceStatus` all feeds | footer-phase.md                                                            | implemented | Including Notifications native list                     |
| Speculative older             | [near-end.md](../architecture/data/feed-surface/near-end.md)               | implemented | Timeline tab coordinator                                |
| Staged row pipeline           | [staged-pipeline.md](../architecture/data/feed-surface/staged-pipeline.md) | implemented | Home/Global/Profile/Thread                              |
| Notifications list mode       | [surface-matrix.md](../architecture/data/feed-surface/surface-matrix.md)   | implemented | Virtua flat list via `FeedScrollSurface`, shared footer |

## Tab Continuity

| Clause                              | Contract                                                                                                                                   | Status      | Notes                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------ |
| Scroll + virtua anchor              | [tab-runtime.md](../architecture/workspace/tab-runtime.md)                                                                                 | implemented | session + IDB                        |
| Top-anchor live inserts             | [feed-memory.md](../architecture/data/feed-memory.md)                                                                                      | implemented | Rust reducer and Svelte anchor tests |
| Feed cursors in snapshot            | [tab-runtime.md](../architecture/workspace/tab-runtime.md), [tab-snapshots.md](../architecture/data/storage/data-classes/tab-snapshots.md) | implemented | `tab-runtime-registry`               |
| `hasOlder` / `hasNewer` in snapshot | [tab-runtime.md](../architecture/workspace/tab-runtime.md)                                                                                 | implemented | runtime snapshot                     |
| Search query in tool snapshot       | [tabs.md](workspace/tabs.md)                                                                                                               | implemented | Search tab fields                    |
| Session cap 32                      | [tab-runtime.md](../architecture/workspace/tab-runtime.md)                                                                                 | implemented | `session-tab-snapshots`              |
| Hidden-mount inactive tab bodies    | [tab-body-mount.md](../architecture/workspace/tab-body-mount.md)                                                                           | implemented | `PaneTabStack`, paused runtimes      |
| DOM-first scroll on tab return      | [tab-retention-flow.md](../architecture/workspace/tab-retention-flow.md)                                                                   | implemented | `hasTracked` in focus sync           |

## Media Upload

| Clause                          | Contract                                       | Status      | Notes                                          |
| ------------------------------- | ---------------------------------------------- | ----------- | ---------------------------------------------- |
| NIP-96 compatibility upload     | [media-upload.md](../protocol/media-upload.md) | implemented | Current Tweet and Profile Edit uploader path   |
| Blossom preferred upload target | [media-upload.md](../protocol/media-upload.md) | implemented | Raw upload, scoped auth, descriptor hash tests |

## Event Actions

| Clause                      | Contract          | Status      | Notes                   |
| --------------------------- | ----------------- | ----------- | ----------------------- |
| `aria-pressed` Heart/Repost | event-actions.md  | implemented |                         |
| Pressed off visible window  | event-actions.md  | implemented | `action-state-index.ts` |
| Persistent action index     | storage/README.md | implemented | hybrid with feed merge  |

## UI System

| Clause                          | Contract                                                                                   | Status      | Notes                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------ |
| Feed identity leading header    | [identity-surfaces.md](../architecture/workspace/ui-system/identity-surfaces.md)           | implemented | `FeedIdentityHeader.svelte`                                  |
| User row overflow menu          | [overflow-actions.md](../architecture/workspace/ui-system/overflow-actions.md)             | implemented | `UserRowOverflowMenu.svelte`                                 |
| Flat New Tab grid               | [new-tab-menu.md](../architecture/workspace/ui-system/new-tab-menu.md)                     | implemented | `NewTab.svelte`, `menu.rs`                                   |
| Upload gate hint                | [media-upload-gate.md](../architecture/workspace/ui-system/media-upload-gate.md)           | implemented | `UploadGateHint.svelte`, attach click routing                |
| Canonical emoji palette         | [emoji-palette.md](../architecture/workspace/ui-system/emoji-palette.md)                   | implemented | `bottom-start` default, position and palette tests           |
| Followees single scroll owner   | [feed-shell.md](../architecture/workspace/ui-system/feed-shell.md)                         | implemented | leading rows inside `FeedScrollSurface`                      |
| Scroll inset single ownership   | [scroll-inset-ownership.md](../architecture/workspace/ui-system/scroll-inset-ownership.md) | implemented | `scroll-layout.css`, tab-shell class test                    |
| Tab kind scroll alignment       | [scroll-alignment.md](../architecture/workspace/ui-system/scroll-alignment.md)             | implemented | shared track-edge tokens and form-tab class test             |
| Hybrid tab shells               | [hybrid-tab-shells.md](../architecture/workspace/ui-system/hybrid-tab-shells.md)           | implemented | `.hybrid-tab.feed-tab` on Custom Request and Author Context  |
| Profile header layout           | [profile-header-layout.md](../architecture/workspace/ui-system/profile-header-layout.md)   | implemented | following count under display name in `ProfileHeader.svelte` |
| Reaction surface split          | [reaction-surfaces.md](../architecture/workspace/ui-system/reaction-surfaces.md)           | implemented | picker vs `ReactionSummary` documented                       |
| Enrichment height tier collapse | [enrichment-height-tiers.md](../architecture/data/feed-surface/enrichment-height-tiers.md) | implemented | tier-tagged measurement keys; reply/zap gap remains          |

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
| Scrollbar split-handle inset          | scroll-layout.md      | implemented | `--scroll-track-edge`, pane body |
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

## Relay Defaults

| Clause                       | Contract                                                     | Status      | Notes                                |
| ---------------------------- | ------------------------------------------------------------ | ----------- | ------------------------------------ |
| Kiri user default relay pair | [default-relays.md](../protocol/default-relays.md)           | implemented | TypeScript and Rust seed tests       |
| User/discovery purpose split | [relay-routing.md](../architecture/network/relay-routing.md) | implemented | Discovery relays excluded from feeds |

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
| Home cache-unavailable follow discovery               | feeds/home.md                        | implemented | `home_feed_cache_tests`, `home_feed_relay_input_tests`, and `home_feed_relay_provider_test` prove diagnostics plus relay recovery.                         |
| Notification `#p` filters                             | feeds/sources/notifications.md       | implemented | `notification-filters.ts`                                                                                                                                  |
| Notifications bounded initial and older relay windows | feeds/sources/notifications.md       | implemented | Initial read includes `(since, until)`; older pages are bounded and based on notification record `createdAt`, with older-load gated by user scroll intent. |
| Home live note subscription includes startup `since`  | feeds/runtime                        | implemented | Live `authorFilters` include startup-bounded `since` to keep initial live inserts protocol-bounded.                                                        |
| Follow-list absence ownership is follow-sub only      | feeds/sources/home.md                | implemented | No-follow-list waits for follow-list kind `3` completion across intended relays (follow-sub EOSE ownership only).                                          |
| Home shared page cursors                              | backend/home-query-lifecycle.md      | implemented | Shared Home query owns cursors; non-Home runtime cursors remain per tab.                                                                                   |
| Timeline regression focused                           | verification.md                      | implemented | Includes Home follow-discovery EOSE ownership and Notifications bounded viewport-fill older paging.                                                        |
| Multi-tab Home ownership                              | feeds/runtime/multi-tab-ownership.md | implemented | Matching Home tabs attach to one backend query and share bootstrap, live leases, and cursors.                                                              |
| Cache-first interval proof                            | data/cache-first-feed-pages.md       | implemented | Interval-union proof and partial relay pruning are covered by unit cache scan tests.                                                                       |
| Warm grouped scan hints                               | data/storage/README.md               | implemented | Hint policy and warm-start scan tests prove conservative relay-span tuning without suppressing reads.                                                      |

## Feed Scroll and Row Chrome

| Clause                                 | Contract                | Status      | Notes                                                                                                          |
| -------------------------------------- | ----------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| Single notification separator          | feed-row-chrome.md      | implemented | list-owned separator on `.notification-row`; embedded `EventRow` suppresses its separator                      |
| Single Notifications scroll owner      | feed-scroll-surface.md  | implemented | `.feed-tab` uses `overflow: hidden` and exactly one `[data-scroll-owner]` owns vertical scroll                 |
| Event More clears scrollbar track      | scroll-layout.md        | implemented | `.event-more` uses `right: var(--scroll-content-inset)` and `.event-main` reserves the same inline-end padding |
| No horizontal overflow on scroll owner | scroll-surface-audit.md | implemented | focused `assertNoHorizontalOverflow` checks scroll owners and `.event-list__viewport`                          |
| Notifications on FeedScrollSurface     | feed-scroll-surface.md  | implemented | Notifications use Virtua via `FeedScrollSurface` and the shared footer/near-end semantics                      |
| Profile in-flow summary rows           | profiles.md             | implemented | `ProfileHeader`, status, load-newer, empty, note, and footer rows share one `EventTreeList` scroll owner       |
| Profile follow-count discovery state   | profiles.md             | partial     | Unknown no longer renders as zero; relay proof details remain active                                           |
| Profile sparse historical empty proof  | profiles.md             | partial     | Searching copy active; full scan planner proof remains open                                                    |
| Stable Tweet publish footer            | tweet.md                | partial     | Footer layout and bounding tests active                                                                        |
| Fixed lkjsxc New Tab item              | workspace/tabs.md       | implemented | Catalog constant, NIP-19 decode, Svelte catalog, and action tests                                              |
| Browser storage prompt removal         | tools/accounts.md       | implemented | Accounts UI no longer exposes the special browser prompt surface                                               |
| Pane.svelte at or below 200 lines      | repository standards    | implemented | Pane header moved to `PaneHead.svelte` to keep the file within the cap                                         |
