# Home

## Purpose

Home is the account-follow feed. It shows notes from the selected account and
its NIP-02 follows.

## Contract

- Home opens from New Tab and is the recovery tab.
- Cached notes render before relay results.
- After authors are known, Home performs one initial relay page without
  `since`, then keeps live subscriptions bounded with startup `since`.
- Account home authors are the active account plus `p` tags from the latest
  kind `3` follow list.
- Relay reads use enabled read relays from the selected default relay set.
- Relay reads go through the subscription manager.
- Events and relay provenance are written through the shared repository.
- Initial and older pages request `30` items.
- The tab keeps a `180` item window and exposes jump to latest after newer
  items are pruned.
- Older pages load after near-bottom scroll or when the loaded rows are shorter
  than the viewport and `hasOlder` remains true.
- Historical relay pages use compound `{createdAt,id}` cursors. Relay `until`
  may over-fetch the boundary second, and results are filtered before merging.
- Live relay reads set `since` when the runtime starts.
- Metadata fetches are limited to authors present in loaded items.
- Deleted or disabled relays are not replaced by hidden public defaults.
- No active account means no relay subscription.
- No follow list means self notes are queried and the state remains visible.
- Loading ends when cached or initial relay data exists, contacted relays finish
  or fail, or a live relay produces matching events.
- A failed relay remains diagnostic and must not block other relays.
- Relay `CLOSED`, `NOTICE`, `AUTH`, parse failure, and invalid signatures are
  visible in lkjstr Log, not inline in the timeline body.
- The timeline body keeps high-level state errors visible, such as unreachable
  relays or authentication requirements.
- Author controls open or focus matching Profile tabs in the same tile.
- Event rows, event id controls, quotes, and references open or focus matching
  Thread tabs in the same tile.
- Post rows do not show relay source text or full public-key text.

## States

- `no-active-account`: cache only; account action required.
- `loading-follows`: active account exists and follow discovery or notes load.
- `no-follow-list`: latest kind `3` is absent; self notes are queried.
- `no-enabled-relay`: selected set has no enabled read relay.
- `auth-required`: a relay sent `AUTH`.
- `subscription-closed`: a relay sent `CLOSED`.
- `relay-failed`: selected relays are unreachable.
- `ready-empty`: relay EOSE completed with no matching notes.
- `ready-with-events`: cache or relay data has matching notes.
- `loadingOlder`: an older cache or relay page is being requested.
- `hasOlder`: more older cached or relay-backed items may exist.
- `hasNewer`: newer resident chunks can be loaded from the top cursor.
