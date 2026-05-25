# Product Backlog

## Purpose

This backlog lists practical product work that is not yet complete. Each item
links to its destination contract and names how to verify it. Items are ordered
by priority after memory stabilization passes.

## Feeds and Loading

| Item                                                                | Destination doc                                                                        | Test strategy                                                             |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Timeline loading indicators (loading, partial, stale, empty, error) | [feeds/home.md](feeds/home.md), [feeds/global.md](feeds/global.md)                     | Playwright Home/Global surface states; unit reducer tests for feed status |
| Profile feed loading indicators                                     | [feeds/profiles.md](feeds/profiles.md)                                                 | Playwright Profile tab states after synthetic relay load                  |
| Notification feed loading indicators                                | [feeds/notifications.md](feeds/notifications.md)                                       | Playwright Notifications tab states                                       |
| Thread loading indicators                                           | [feeds/threads.md](feeds/threads.md)                                                   | Playwright Thread tab open from event click                               |
| Relay read loading in Custom Request and Search                     | [tools/custom-request.md](tools/custom-request.md), [tools/search.md](tools/search.md) | Playwright run/search with synthetic relay                                |
| Publish flow loading state in Tweet                                 | [tools/tweet.md](tools/tweet.md)                                                       | Playwright compose/publish against synthetic relay                        |
| Prefetch profiles for visible and near-visible events               | [feed-memory.md](../architecture/data/feed-memory.md)                                  | Memory e2e hydration counter caps; unit prefetch dedupe                   |
| Prefetch event references for visible rows                          | [event-tree.md](../architecture/data/event-tree.md)                                    | Unit reference index cap; Playwright reference preview                    |

## Workspace and Tabs

| Item                                                                       | Destination doc                                                                            | Test strategy                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Touch/Android tab drag without snap-back                                   | implemented per [tab-strip-gestures.md](../architecture/workspace/tab-strip-gestures.md)   | Playwright mobile viewport pan and long-press drag                  |
| Drop-zone feedback: center insert vs edge split                            | implemented per [pane-drop-target.md](../architecture/workspace/pane-drop-target.md)       | Playwright half-pane overlay geometry                               |
| Zero-tile and zero-tab behavior without errors                             | [workspace/scope.md](workspace/scope.md)                                                   | Playwright close-all-tabs e2e                                       |
| Resizable pane polish (minimum sizes, snap)                                | [workspace/panes.md](workspace/panes.md), [resize.md](../architecture/workspace/resize.md) | Playwright resize handle interaction                                |
| Welcome quick-start aligned with root README                               | [tools/welcome.md](tools/welcome.md)                                                       | Playwright startup Welcome content                                  |
| Clean startup: Welcome focused, Accounts lower, no premature relay connect | [workspace/workspace.md](workspace/workspace.md)                                           | Playwright openCleanWorkspace; memory counter relay clients at zero |

## Accounts and Signing

| Item                               | Destination doc                                                                                                   | Test strategy                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Active account state clarity       | [tools/accounts.md](tools/accounts.md)                                                                            | Playwright account panel labels                            |
| NIP-07 vs local key risk messaging | [tools/accounts.md](tools/accounts.md), [local-secret-security.md](../architecture/data/local-secret-security.md) | Playwright signer type display; no secrets in debug export |
| Import/export boundary clarity     | [tools/accounts.md](tools/accounts.md)                                                                            | Playwright import flow; unit account store                 |

## Diagnostics and Settings

| Item                                                    | Destination doc                                      | Test strategy                                                         |
| ------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------- |
| Relay diagnostics clarity (connection, EOSE, OK counts) | [tools/stats.md](tools/stats.md)                     | Playwright Stats tab rows; unit bounded diagnostic summary            |
| Notification feed reliability under relay churn         | [feeds/notifications.md](feeds/notifications.md)     | Playwright notifications with synthetic events                        |
| Profile feed reliability under relay churn              | [feeds/profiles.md](feeds/profiles.md)               | Playwright profile hydration                                          |
| Event reference rendering hardening                     | [event-tree.md](../architecture/data/event-tree.md)  | Unit NIP-10/NIP-18 derivation; Playwright reference unavailable state |
| Custom emoji rendering hardening                        | [custom-emoji.md](../protocol/custom-emoji.md)       | Unit NIP-30 parse; Playwright emoji in note                           |
| Upload settings clarity                                 | [tools/upload-settings.md](tools/upload-settings.md) | Playwright Upload Settings tab fields                                 |

## Deferred (design-only or out of scope)

| Item                                   | Notes                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| Passkey-protected local secret storage | Design-only per [local-secret-security.md](../architecture/data/local-secret-security.md) |
| Encrypted direct messages              | Not implemented per [nip-support.md](../protocol/nip-support.md)                          |
| Wallet custody for zaps                | Out of scope; invoice handoff only per [zaps.md](../protocol/zaps.md)                     |

## Reference

- [current-state.md](../current-state.md): implemented state and known gaps.
- [heap-retention.md](../architecture/data/heap-retention.md): memory work precedes polish items.
