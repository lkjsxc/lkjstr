# Profiles

## Purpose

Profile tabs show identity metadata and authored text notes.

## Contract

- Profile tabs open from identity actions, not New Tab.
- The tab receives a hex pubkey from the workspace command.
- Runtime loads cached metadata and notes before relay data.
- Metadata cache reads are latest-only and consult memory before IndexedDB.
  Older metadata events must never replace newer profile metadata.
- Relay reads use enabled read relays from the selected default relay set.
- Profile performs one initial metadata and notes relay page without `since`,
  then keeps live subscriptions bounded with startup `since`.
- Initial and older note pages request `30` items.
- Profile note lists keep a `180` item window.
- Profile renders as one scroll flow: summary first, then Notes rows in normal
  document order. The Profile tab is the only scroll container for this flow.
- Profile metadata supports banner, picture, display name, name, NIP-05,
  website, Lightning address, and about text.
- Profile displays banner media when metadata provides `banner`.
- Profile editing is not inline. Own-profile actions open Profile Edit in the
  same tile.
- Profile Edit merges with the latest cached kind `0` metadata. Blank known
  fields delete those keys; unknown keys and `lud06` remain preserved.
- Successful Profile Edit publishes kind `0` to enabled write relays, stores
  the result locally, and notifies open Profile tabs to refresh.
- Notes must not render through a dedicated full-height child scroller.
- Profile identity surfaces show the full `npub`, and full `nprofile` when
  relay hints are available. They are not abbreviated in Profile.
- Long `about`, `npub`, `nprofile`, and website values wrap without overlapping
  the Notes section at desktop, mobile, or narrow split-pane widths.
- Profile notes start below the full profile header.
- Older profile notes load after near-bottom scroll or viewport auto-fill.
- Historical note pages use compound `{createdAt,id}` cursors and local relay
  boundary filtering.
- Live relay reads set `since` when the profile runtime starts.
- Closing the tab closes profile subscriptions.
- Mention and event tokens inside profile notes use the shared post renderer and
  open Profile or Thread in the same tile.
