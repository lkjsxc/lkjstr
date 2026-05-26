# Event Tree

## Purpose

Event tree defines how feed-like tabs render notes and replies with one shared
model.

## Contract

- Feed pages are converted into roots and child branches before rendering.
- Roots sort newest first.
- Child branches sort newest first.
- A reply whose parent is missing is shown as a root until the parent arrives.
- The UI renders the flattened tree through the shared event tree list.
- Home, Global, Thread, Search, Custom Request, Author Context, Profile Notes,
  and Notifications use the shared virtual `FeedSurfaceList` / `EventTreeList`.
- Post rows hide relay source text and full public-key text.
- Rows render avatar, display name, optional nip05 subtitle only, timestamp,
  and wrapped content. npub and hex pubkeys never appear beside the display name
  on feed rows.
- Timeline rows do not use a left-side new-event stripe. Notification unread
  styling stays scoped to notification rows only.
- Profile and reference hydration prefetch authors and reference targets for
  visible rows and rows within one viewport of the visible range.
- Long labels, ids, URLs, code, and note content wrap inside the row.
