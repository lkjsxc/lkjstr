# Profile Runtime

## Purpose

Profile runtime owns metadata and authored-note loading for one pubkey.

## Contract

- Profile tabs receive a pubkey from workspace actions.
- Runtime reads cached metadata, follow list, and notes first.
- Initial relay loading splits metadata, follow-list, and note reads. A
  metadata or follow-list event must never consume one of the visible note page
  slots.
- Runtime subscribes for kind `0` metadata, kind `3` follow lists, and authored
  feed-display events by author.
- Metadata and follow-list events are stored for profile state but never mixed
  into the visible posts list.
- Metadata hydration stores and returns the effective latest cached profile, not
  a stale profile parsed from an older rejected event.
- Note rows preserve full relay provenance from repository records and relay
  pages. `cache` is used only when no relay evidence is available.
- Runtime keeps a `180` item note window.
- Runtime exposes `loadOlder()` with an explicit oldest cursor and
  `loadNewer()` with an explicit newest cursor after top pruning.
- State exposes `loadingOlder`, `hasOlder`, `loadingNewer`, `hasNewer`,
  `oldestCursor`, `newestCursor`, and follow-list metadata used for the visible
  following count.
- Live posts are stored while browsing an older pruned window, but visible
  insertion is deferred until newer notes are loaded.
- Historical note reads use `until`; live reads set `since` when started.
- Relay reads use enabled read relays from the selected default relay set.
- Closing the tab closes subscriptions.
