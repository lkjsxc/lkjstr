# UI Polish Backlog

## Purpose

This file turns visible UX polish targets into executable acceptance criteria.
Update a row before changing its source anchors. Close a row only after the
named test gate passes.

## Identity And Overflow

| Target               | Acceptance                                                                     | Source anchors                                       | Gate                       |
| -------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------- | -------------------------- |
| User Timeline header | Leading row uses `FeedIdentityHeader`; no raw npub or hex                      | `RustIslandHost.svelte`, `FeedIdentityHeader.svelte` | identity contract test     |
| Followees rows       | Row click opens Profile; Timeline and Copy npub only in overflow menu          | Followees Rust island, `UserEventRow.svelte`         | followees tab render test  |
| Profile overflow     | Open user timeline lives in copy overflow menu, not a large fact button        | `ProfileHeader.svelte`                               | profile header layout test |
| Profile spacing      | Following count under display name; about block has `space-5` gap before notes | `ProfileHeader.svelte`, `identity.css`               | CSS contract test          |

## New Tab

| Target       | Acceptance                                                             | Source anchors                        | Gate                 |
| ------------ | ---------------------------------------------------------------------- | ------------------------------------- | -------------------- |
| Flat catalog | One option grid; no filter input, count, or primary/secondary headings | `NewTab.svelte`, `new-tab-options.ts` | new-tab-options test |
| Rust parity  | Leptos New Tab uses same flat grid and card content                    | `menu.rs`, `tab_catalog.rs`           | new_tab_catalog_test |

## Scroll Alignment

| Target          | Acceptance                                                                     | Source anchors                                     | Gate                                |
| --------------- | ------------------------------------------------------------------------------ | -------------------------------------------------- | ----------------------------------- |
| Form tab class  | Every tool tab root carries `.form-tab` or documented hybrid class             | tab `*.svelte` roots, `scroll-layout.css`          | scroll-layout-css test              |
| Tab kind switch | Feed and form scroll owners in the same pane share track-edge inset within 1px | `scroll-layout.css`, workspace shell               | tab-kind-scroll-alignment host test |
| Hybrid tabs     | Custom Request and Author Context keep one feed scroll owner                   | `CustomRequestTab.svelte`, `RustIslandHost.svelte` | hybrid-tab-shell test               |

## Media Upload Gate

| Target              | Acceptance                                                           | Source anchors                                           | Gate                   |
| ------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------- |
| Visible hint        | Unconfigured upload shows canonical hint copy                        | `UploadGateHint.svelte`                                  | upload gate unit test  |
| Attach click routes | Attach or image picker click opens Upload Settings when unconfigured | `TweetMediaControls.svelte`, `ProfileImageUpload.svelte` | upload gate click test |

## Emoji Palette

| Target          | Acceptance                                                         | Source anchors                                     | Gate                    |
| --------------- | ------------------------------------------------------------------ | -------------------------------------------------- | ----------------------- |
| Canonical entry | Only `EmojiPaletteButton` opens the picker on event rows and Tweet | `EventActions.svelte`, `TweetMediaControls.svelte` | emoji palette grep gate |
| Tile portal     | Popover portals to pane host; survives Virtua dematerialization    | `AnchoredPopover.svelte`, `popover-portal.ts`      | emoji palette host test |
| Placement       | Event action bars use `bottom-start` preferred placement           | `EmojiPaletteButton.svelte`, `position.ts`         | position unit test      |

## Feed Height

| Target                   | Acceptance                                                       | Source anchors                                      | Gate                                |
| ------------------------ | ---------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------- |
| Tier-tagged measurements | Enriched DOM measurements cannot satisfy structural-tier lookups | `row-height-reservation-keys.ts`                    | row-height-reservation-tier test    |
| Quote/reply collapse     | Dematerialized reference rows shrink to structural estimate      | `row-height-reservation.ts`                         | tier collapse test                  |
| Reply/zap panels         | Expanded inline panels may defer to action-state shape hash      | `enrichment-height-tiers.md`, `EventActions.svelte` | documented gap or action-state test |

## Edit Rule

Do not add mock UI states. Loading, unavailable, partial, and empty states must
come from runtime, relay, coverage, or storage state the source path already
owns.

## Related

- [surface-source-map.md](surface-source-map.md).
- [scroll-alignment.md](scroll-alignment.md).
- [../../../product/audit/product-polish.md](../../../product/audit/product-polish.md).
