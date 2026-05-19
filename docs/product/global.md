# Global

## Purpose

Global shows recent kind `1` notes from the selected readable relay set.

## Contract

- Global opens from New Tab.
- It does not require an active account.
- Cached notes render before relay results.
- Relay reads request recent kind `1` notes without author filtering.
- Live relay events prepend into the same repository-backed feed model.
- Loading ends when cached items exist, a relay sends notes, any relay reaches
  EOSE, or every contacted relay reaches a terminal failure state.
- Partial relay failure stays visible in diagnostics but does not block the
  feed.
- Infinite scrolling uses feed cursors and older relay pages.
- Identity controls open Profile tabs in the same tile.
- Event controls open Thread tabs in the same tile.
