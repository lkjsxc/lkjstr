# Global

## Purpose

Global shows recent kind `1` notes from the selected readable relay set.

## Contract

- Global opens from New Tab.
- It does not require an active account.
- Cached notes render before relay results.
- Relay reads request recent kind `1` notes without author filtering.
- Live relay events prepend into the same repository-backed feed model.
- Initial and older pages request `30` items.
- The tab keeps a `180` item window.
- Older pages load only after the event list scrolls near the bottom.
- Historical relay pages use `until` and close after EOSE or timeout.
- Live relay reads set `since` when the runtime starts.
- Loading ends when cached items exist, a relay sends notes, any relay reaches
  EOSE, or every contacted relay reaches a terminal failure state.
- Partial relay failure stays visible in lkjstr Log but does not block the feed.
- The Global body does not render low-level relay diagnostic rows inline.
- Infinite scrolling uses compound feed cursors and older or newer relay pages.
- Near-top scroll loads newer chunks when the window prunes newer items.
- Identity controls open Profile tabs in the same tile.
- Event controls open Thread tabs in the same tile.
