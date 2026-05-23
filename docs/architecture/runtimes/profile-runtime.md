# Profile Runtime

## Purpose

Profile runtime owns metadata and authored-note loading for one pubkey.

## Contract

- Profile tabs receive a pubkey from workspace actions.
- Runtime reads cached metadata and notes first.
- Runtime subscribes for kind `0` metadata, kind `3` follow lists, and authored
  feed-display events by author.
- Metadata and follow-list events are stored for profile state but never mixed
  into the visible posts list.
- Metadata hydration stores and returns the effective latest cached profile, not
  a stale profile parsed from an older rejected event.
- Note rows preserve relay provenance from repository records. `cache` is used
  only when no relay evidence is available.
- Runtime keeps a `180` item note window.
- Runtime exposes `loadOlder()` with an explicit oldest cursor. Live reads
  recover newer events without one-way metadata/post mixing.
- State exposes `loadingOlder`, `hasOlder`, `oldestCursor`, and follow-list
  metadata used for the visible following count.
- Historical note reads use `until`; live reads set `since` when started.
- Relay reads use enabled read relays from the selected default relay set.
- Closing the tab closes subscriptions.
