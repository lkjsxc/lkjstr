# Tab Shell Layout

## Purpose

Tab shell layout classifies tab roots so scroll ownership is explicit for LLM
readers and retention code.

## Contract

### `.feed-tab`

- `overflow: hidden` on the tab root.
- `height: 100%`, `min-height: 0`, `min-width: 0`.
- Exactly one child owns vertical scroll via `FeedScrollSurface` or an
  equivalent documented scroll root with `data-scroll-owner`.
- Used by: Home, Global, Search, Profile, Thread, Notifications.
- Profile keeps summary rows and note rows in that single child. A nested Notes
  scroller is not allowed.

### `.form-tab`

- May scroll at the tab shell with `overflow: auto` when the whole panel is
  the tool surface.
- Used by: Settings, Relay Settings, Stats, Welcome, Upload Settings, Accounts,
  Tweet, Profile Edit, Mine npub, Custom Request (when not using feed shell),
  Author Context (when not using feed shell), lkjstr Log, New Tab, and Public
  Chat.

## New Tab Filter Layout

- The filter row sits above option groups inside the New Tab form surface.
- The search input uses the available width and must not create horizontal
  overflow.
- A clear control is keyboard reachable when the query is non-empty.
- Group headings remain visible only for groups with matching options.
- The no-results state occupies the same scroll root as the option groups.
- Svelte and Leptos use the same pure catalog filtering rules.

### `.data-tab` (compat alias)

- Existing tabs may still include `data-tab` for shared form styling.
- Feed tabs add `feed-tab` and must not rely on `.data-tab` for vertical scroll.

## Pane Body

- `.pane-body` remains a non-scrolling flex child with `overflow: hidden`.
- Tab retention captures scroll from `[data-scroll-owner]` inside the active tab.

## Related

- [feed-scroll-surface.md](../data/feed-surface/feed-scroll-surface.md).
- [scroll-layout.md](scroll-layout.md).
- [tab-retention-flow.md](tab-retention-flow.md).
- [ui-composition.md](ui-composition.md).
