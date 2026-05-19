# Profiles

## Purpose

Profile tabs show identity metadata and authored text notes.

## Contract

- Profile tabs open from identity actions, not New Tab.
- The tab receives a hex pubkey from the workspace command.
- Runtime loads cached metadata and notes before relay data.
- Relay reads use enabled read relays from the selected default relay set.
- Profile performs one initial metadata and notes relay page without `since`,
  then keeps live subscriptions bounded with startup `since`.
- Initial and older note pages request `30` items.
- Profile note lists keep a `180` item window.
- The metadata header has bounded height so long profile text cannot starve the
  Notes list.
- Older profile notes load after near-bottom scroll or viewport auto-fill.
- Historical note pages use compound `{createdAt,id}` cursors and local relay
  boundary filtering.
- Live relay reads set `since` when the profile runtime starts.
- Closing the tab closes profile subscriptions.
