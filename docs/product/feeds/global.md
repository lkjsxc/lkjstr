# Global

## Purpose

Global shows recent notes and reposts from the selected readable relay set.

## Contract

- Global opens from New Tab.
- It does not require an active account.
- Cached notes render before relay results.
- Relay reads request recent kinds `1`, `6`, and `16` without author filtering.
- Global performs one initial adaptive relay scan with bounded `since`/`until`
  windows, then keeps live subscriptions bounded with startup `since`.
- Live relay events prepend into the same repository-backed feed model.
- Initial and older pages request `30` items.
- The tab keeps a `180` item window.
- Older pages load after near-bottom scroll or when the loaded rows are shorter
  than the viewport and `hasOlder` remains true.
- Initial and historical relay pages use compound `{createdAt,id}` cursors,
  adaptive bounded `since`/`until` windows, local boundary filtering, and
  merged relay provenance. Timeout or non-EOSE relay status does not prove
  exhaustion.
- Newer catch-up reads cache and relays, scanning newest bounded windows first
  so the newest matching relay events are restored before older catch-up
  candidates.
- Live relay reads set `since` when the runtime starts.
- Loading ends when cached items exist, a relay sends notes, any relay reaches
  EOSE, or every contacted relay reaches a terminal failure state.
- Partial relay failure stays visible in lkjstr Log but does not block the feed.
- The Global body does not render low-level relay diagnostic rows inline.
- Infinite scrolling uses compound feed cursors and older or newer relay pages.
- Near-top scroll loads newer chunks when the window prunes newer items.
- Identity controls open or focus matching Profile tabs in the same tile.
- Event rows open or focus matching Thread tabs in the same tile.
- Post rows do not show short event ids in row metadata.
- Global uses the same runtime-owned profile hydration and sensitive-content
  behavior as Home.
- Repost rows render embedded content when verified, otherwise a target
  reference fallback. Generic repost rows label the target kind when available.
