# Search

## Purpose

Search documents the user-facing query surface for cached and relay-backed
matches.

## Contract

- Search opens from New Tab.
- The query field opens empty, even when an active account exists.
- Search never populates the query from the active account.
- Search only runs after the user enters text and submits the form.
- Queries run against cached event content in local storage.
- Queries also send NIP-50 `search` filters to enabled read relays in the
  selected default relay set.
- Remote results are relay-support-dependent. Relays should advertise NIP-50 in
  NIP-11 `supported_nips`; relays that ignore `search` do not produce matches.
- Older search pages use compound `{createdAt,id}` cursors so same-second
  cached events are not skipped.
- Cached matches and relay matches are sorted by `{created_at,id}` and merged
  by real event id with all relay provenance preserved.
- Results render through the shared event row surface, footer phase, bounded
  short-feed viewport-fill, and automatic row-anchor restore.
- Search query text is preserved in feed `filterState` for tab switch and
  reload restore.
- Scroll position restores per Search tab after tab switching and reload.
- Search does not require an active signing account.
