# Profile Runtime

## Purpose

Profile runtime owns metadata and authored-note loading for one pubkey.

## Contract

- Profile tabs receive a pubkey from workspace actions.
- Runtime reads cached metadata, follow list, and notes first.
- Initial relay loading splits metadata, follow-list, and note reads. A
  metadata or follow-list event must never consume one of the visible note page
  slots.
- Runtime subscribes for kind `0` metadata, kind `10002` relay-list metadata,
  kind `3` follow lists, and authored feed-display events by author.
- Initial metadata reads use selected relays, author routes, and discovery
  relays for kinds `0` and `10002`.
- Initial follow-list reads use selected relays and author routes only. Initial
  post reads use the same relay set through adaptive bounded scan windows,
  excluding discovery relays unless explicitly selected/imported.
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
- Initial and historical note reads use adaptive windows with `since` and
  `until`; live reads set `since` when started.
- Relay reads use selected read relays as base and fallback plus bounded author
  routes from NIP-65, NIP-02, relay receipts, and observed discovery evidence.
- Closing the tab closes subscriptions.
