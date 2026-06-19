# Surface Source Map

## Purpose

This file maps UI system contract clauses to Svelte source anchors and closing
test gates. Use it when an LLM agent needs to find the owning implementation
without searching the whole tree.

## Identity Surfaces

| Contract clause     | Component                    | Tab or consumer                         | Test gate                  |
| ------------------- | ---------------------------- | --------------------------------------- | -------------------------- |
| Feed leading header | `FeedIdentityHeader.svelte`  | `RustIslandHost.svelte`                 | identity-surfaces contract |
| User list row       | `UserEventRow.svelte`        | Followees Rust island                   | followees scroll rows      |
| Row overflow menu   | `UserRowOverflowMenu.svelte` | `UserEventRow.svelte`                   | overflow-actions contract  |
| Inline chip         | `IdentityChip.svelte`        | `AccountRow.svelte`, `EventMeta.svelte` | account tests              |
| Profile card        | `ProfileHeader.svelte`       | `ProfileTab.svelte`                     | profile header layout      |

## Overflow And Actions

| Contract clause    | Component                           | Tab or consumer                                    | Test gate             |
| ------------------ | ----------------------------------- | -------------------------------------------------- | --------------------- |
| Profile copy menu  | `ProfileHeader.svelte` details menu | `ProfileTab.svelte`                                | profile header layout |
| Event action bar   | `EventActions.svelte`               | `EventFragmentRow.svelte`, `EventRow.svelte`       | event-actions tests   |
| Emoji picker entry | `EmojiPaletteButton.svelte`         | `EventActions.svelte`, `TweetMediaControls.svelte` | emoji palette tests   |

## Feed Shell And Scroll

| Contract clause   | Component                  | Tab or consumer                              | Test gate                    |
| ----------------- | -------------------------- | -------------------------------------------- | ---------------------------- |
| Virtual feed list | `FeedScrollSurface.svelte` | feed tabs, Followees Rust island             | feed-scroll-surface tests    |
| Event tree list   | `EventTreeList.svelte`     | Home, Profile, Thread, Search, User Timeline | scroll-anchor tests          |
| Row measurement   | `FeedMeasuredRow.svelte`   | `EventTreeListSurface.svelte`                | row-height-reservation tests |
| Scroll tokens     | `scroll-layout.css`        | all tab roots                                | scroll-layout-css test       |

## Tool Surfaces

| Contract clause  | Component               | Tab or consumer                                          | Test gate            |
| ---------------- | ----------------------- | -------------------------------------------------------- | -------------------- |
| Flat New Tab     | `NewTab.svelte`         | `PaneTabBody.svelte`                                     | new-tab-options test |
| Upload gate hint | `UploadGateHint.svelte` | `TweetMediaControls.svelte`, `ProfileImageUpload.svelte` | upload gate test     |
| Settings row     | `SettingsRow.svelte`    | `SettingsTab.svelte`                                     | settings tests       |

## Hybrid Tabs

| Contract clause        | Component                 | Tab or consumer     | Test gate             |
| ---------------------- | ------------------------- | ------------------- | --------------------- |
| Request toolbar + feed | `CustomRequestTab.svelte` | workspace feed body | hybrid-tab-shell test |
| Author context feed    | `RustIslandHost.svelte`   | workspace feed body | hybrid-tab-shell test |

## Rust Leptos Mirrors

| Contract clause       | Component           | Crate path                                          | Test gate                  |
| --------------------- | ------------------- | --------------------------------------------------- | -------------------------- |
| New Tab grid          | `NewTabMenu`        | `crates/lkjstr-ui/src/workspace/menu.rs`            | new_tab_catalog_test       |
| Tweet draft shell     | `TweetTab`          | `crates/lkjstr-ui/src/workspace/tweet.rs`           | tweet provider tests       |
| Upload settings shell | `UploadSettingsTab` | `crates/lkjstr-ui/src/workspace/upload_settings.rs` | upload settings host tests |

## Related

- [README.md](README.md).
- [polish-backlog.md](polish-backlog.md).
- [../ui-composition.md](../ui-composition.md).
