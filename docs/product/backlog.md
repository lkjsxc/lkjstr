# Product Backlog

## Purpose

This backlog lists practical product work that is not yet complete. Each item
links to its destination contract and names how to verify it. Items are ordered
by priority after memory stabilization passes.

## In Progress

| Item                            | Destination doc                                                                | Test strategy                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Rust relay optimizer foundation | [relay-optimizer/README.md](../architecture/network/relay-optimizer/README.md) | Rust relay score, scan planner, storage, WASM bridge, Stats, and synthetic relay tests |

NIP-11-driven request budgeting and diagnostics are implemented and tracked in
[doc-impl-audit.md](doc-impl-audit.md).

## User-Requested Reliability And Rust Migration

| Item                             | Destination doc                                       | Test strategy                                                   |
| -------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| Top-anchor live inserts          | [feed-memory.md](../architecture/data/feed-memory.md) | Rust reducer plus event-list anchor tests                       |
| Followee count loading state     | [profiles.md](feeds/profiles.md)                      | Profile header and Rust follow-count state tests                |
| Bounded User Timeline runtime    | [user-timeline.md](feeds/user-timeline.md)            | Huge follow graph chunking and degraded-mode tests              |
| Cache preview and hold policy    | [feed-memory.md](../architecture/data/feed-memory.md) | Rust cache policy and User Timeline cache-display tests         |
| Browser storage prompt removal   | [accounts.md](tools/accounts.md)                      | Grep, Accounts UI, and Custom Request regression tests          |
| Search functionality             | [search.md](tools/search.md)                          | SQLite token-index, cursor, NIP-50 merge, and diagnostics tests |
| Fixed lkjsxc New Tab item        | [tabs.md](workspace/tabs.md)                          | Rust catalog, NIP-19 decode, Svelte catalog, and action tests   |
| Stable Tweet publish layout      | [tweet.md](tools/tweet.md)                            | Composer footer bounding-rect and shortcut tests                |
| Profile sparse historical scan   | [profiles.md](feeds/profiles.md)                      | Sparse old-note synthetic relay and false-empty tests           |
| Visibility-prioritized hydration | [feed-memory.md](../architecture/data/feed-memory.md) | Rust scheduler, visible-range, pause, cancel, and dedupe tests  |

## Completed (feeds)

| Item                                                      | Contract                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------------- |
| Cache-first grouped feed pages with partial relay pruning | [cache-first-feed-pages.md](../architecture/data/cache-first-feed-pages.md) |
| Warm grouped scan hints separated from proof              | [storage/README.md](../architecture/data/storage/README.md)                 |

## Completed (network)

| Item                                            | Contract                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------- |
| NIP-11-driven request budgeting and diagnostics | [request-budget/README.md](../architecture/network/request-budget/README.md) |

## Completed (media)

| Item                     | Contract                                       |
| ------------------------ | ---------------------------------------------- |
| Blossom provider adapter | [media-upload.md](../protocol/media-upload.md) |

## Completed (workspace)

| Item                                                      | Contract                                                                                                                                                          |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Touch/Android tab drag without snap-back                  | [tab-strip-gestures.md](../architecture/workspace/tab-strip-gestures.md)                                                                                          |
| No left-side new-event stripe on feed rows                | [event-tree.md](../architecture/data/event-tree.md)                                                                                                               |
| nip05-only feed identity subtitles                        | [identity-rendering.md](../architecture/network/identity-rendering.md)                                                                                            |
| Tile-scoped emoji picker                                  | [tile-overlays.md](../architecture/workspace/tile-overlays.md)                                                                                                    |
| Feed scroll surface + notification row chrome unification | [feed-scroll-surface.md](../architecture/data/feed-surface/feed-scroll-surface.md) and [feed-row-chrome.md](../architecture/data/feed-surface/feed-row-chrome.md) |
| Welcome document with working tab links                   | [tools/welcome.md](tools/welcome.md)                                                                                                                              |

## Feeds and Loading

| Item                                                            | Destination doc                                                                        | Test strategy                                                              |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Timeline loading indicators (partial, stale, empty copy polish) | [feeds/home.md](feeds/home.md), [feeds/global.md](feeds/global.md)                     | focused tests Home/Global surface states; refine copy beyond shared footer |
| Profile feed loading indicators                                 | [feeds/profiles.md](feeds/profiles.md)                                                 | focused tests Profile tab states after synthetic relay load                |
| Notification feed loading indicators                            | [feeds/notifications.md](feeds/notifications.md)                                       | focused tests Notifications tab states                                     |
| Thread loading indicators                                       | [feeds/threads.md](feeds/threads.md)                                                   | focused tests Thread tab open from event click                             |
| Relay read loading in Custom Request and Search                 | [tools/custom-request.md](tools/custom-request.md), [tools/search.md](tools/search.md) | focused tests run/search with synthetic relay                              |
| Publish flow loading state in Tweet                             | [tools/tweet.md](tools/tweet.md)                                                       | focused tests compose/publish against synthetic relay                      |
| Prefetch profiles for visible and near-visible events           | [feed-memory.md](../architecture/data/feed-memory.md)                                  | Memory focused hydration counter caps; unit prefetch dedupe                |
| Prefetch event references for visible rows                      | [event-tree.md](../architecture/data/event-tree.md)                                    | Unit reference index cap; focused tests reference preview                  |

## Workspace and Tabs

| Item                                                                       | Destination doc                                                                            | Test strategy                                                          |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Touch/Android tab drag without snap-back                                   | implemented per [tab-strip-gestures.md](../architecture/workspace/tab-strip-gestures.md)   | focused tests mobile viewport pan and long-press drag                  |
| Pane chrome scope for drag splits                                          | [pane-chrome-scope.md](../architecture/workspace/pane-chrome-scope.md)                     | Unit pane-drop-resolve; focused tests header vs body zones             |
| Tab retention scroll + reload                                              | implemented per [tab-retention-flow.md](../architecture/workspace/tab-retention-flow.md)   | focused tests tab-retention feed + settings scroll                     |
| Zero-tile and zero-tab behavior without errors                             | [workspace/scope.md](workspace/scope.md)                                                   | focused tests close-all-tabs focused                                   |
| Resizable pane polish (minimum sizes, snap)                                | [workspace/panes.md](workspace/panes.md), [resize.md](../architecture/workspace/resize.md) | focused tests resize handle interaction                                |
| Clean startup: Welcome focused, Accounts lower, no premature relay connect | [workspace/workspace.md](workspace/workspace.md)                                           | focused tests openCleanWorkspace; memory counter relay clients at zero |

## Accounts and Signing

| Item                               | Destination doc                                                                                                   | Test strategy                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Active account state clarity       | [tools/accounts.md](tools/accounts.md)                                                                            | focused tests account panel labels                            |
| NIP-07 vs local key risk messaging | [tools/accounts.md](tools/accounts.md), [local-secret-security.md](../architecture/data/local-secret-security.md) | focused tests signer type display; no secrets in debug export |
| Import/export boundary clarity     | [tools/accounts.md](tools/accounts.md)                                                                            | focused tests import flow; unit account store                 |

## Diagnostics and Settings

| Item                                             | Destination doc                                                                                    | Test strategy                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Relay diagnostics polish beyond current counters | [tools/stats.md](tools/stats.md)                                                                   | focused tests Stats tab rows; unit bounded diagnostic summary            |
| Relay optimizer Stats projection                 | [relay-optimizer/stats-projection.md](../architecture/network/relay-optimizer/stats-projection.md) | Unit providers and focused tests Stats rows without relay subscriptions  |
| Notification feed reliability under relay churn  | [feeds/notifications.md](feeds/notifications.md)                                                   | focused tests notifications with synthetic events                        |
| Profile feed reliability under relay churn       | [feeds/profiles.md](feeds/profiles.md)                                                             | focused tests profile hydration                                          |
| Event reference rendering hardening              | [event-tree.md](../architecture/data/event-tree.md)                                                | Unit NIP-10/NIP-18 derivation; focused tests reference unavailable state |
| Custom emoji rendering hardening                 | [custom-emoji.md](../protocol/custom-emoji.md)                                                     | Unit NIP-30 parse; focused tests emoji in note                           |
| Upload settings clarity                          | [tools/upload-settings.md](tools/upload-settings.md)                                               | focused tests Upload Settings tab fields                                 |

## Deferred (design-only or out of scope)

| Item                                   | Notes                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| Passkey-protected local secret storage | Design-only per [local-secret-security.md](../architecture/data/local-secret-security.md) |
| Encrypted direct messages              | Not implemented per [nip-support.md](../protocol/nip-support.md)                          |
| Wallet custody for zaps                | Out of scope; invoice handoff only per [zaps.md](../protocol/zaps.md)                     |

## Reference

- [current-state.md](../current-state.md): implemented state and known gaps.
- [heap-retention.md](../architecture/data/heap-retention.md): memory work precedes polish items.
