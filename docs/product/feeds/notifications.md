# Notifications

## Purpose

The Notifications tab shows relay-backed account activity with a lightweight
notification context header and the source event as the primary body.

## Contract

- The tab opens from New Tab.
- Records are scoped to the active account pubkey.
- Mentions, replies, reactions, reposts, quotes, profile references, and zap
  receipts are indexed.
- Profile references are indexed when metadata points at the active account.
- Selected read relays are the base and fallback. Notifications may also use
  the active account's NIP-65 read relays for `#p` reads and selected fallback
  for context.
- Notification events are written through the shared repository.
- Notifications tab initial and older pages request `30` records.
- Notification relay sync starts when the Notifications tab is opened.
- Notification tabs keep a `180` record window. Windowing is based on
  notification records, not the number of resolved source events.
- Older notifications load after near-bottom scroll using
  `max(1200px, 1.5×viewport)` or an equivalent sentinel margin.
- One speculative older page may prefetch when near end while `hasOlder` is
  true.
- Shared `FeedSurfaceStatus` footer shows loading, end of history, and errors.
- Notifications use the shared virtual feed list with the same bottom status
  semantics as Home and Global.
- Historical relay pages use interval windows with `since` and `until` from
  the oldest loaded notification event.
- Live relay reads set `since` when the notification runtime starts.
- Visible notifications are marked read when the tab is visible and receives
  focus.
- Initial loading settles after local records load and subscription setup
  finishes, even when no notification event arrives.
- Partial relay failure stays visible in diagnostics but does not block cached
  or reachable notification records.
- Empty state is explicit when no records exist.
- Rows use a left-aligned action context header followed by the source
  notification event rendered with the canonical Timeline `EventRow`.
- The outer actor chip is hidden when the loaded source event already shows
  the same actor, defined by `sourceEvent.pubkey === record.actorPubkey`.
- Target/root context is fallback-only, explicitly labeled, and shown only when
  the source notification event is unavailable. Fallback rows still show the
  outer actor because the target/root author can differ from the notification
  actor.
- Windowed state keeps only source and target/root events referenced by
  retained records. Missing source events remain visible as unavailable rows.
- Notification rows do not force compact event display, disable event actions,
  or hide the event More menu.
- Clicking the event row opens or focuses the correct Thread tab. Buttons and
  links inside the event keep their local behavior.
- Reaction and repost rows show the same visible action label style as other
  notification rows and do not use avatar overlay badges.
- Action labels cover mention, reply, reaction, repost, quote, zap, and
  profile-reference records.
- Long event content, ids, relay URLs, and context fields wrap within the row.
- Notification event row metadata does not show short event ids.
- Notification event content uses canonical Timeline row behavior, including
  mention links, event links, media URL hiding, bounded media embeds, action
  controls, the More menu, and deduped previews.
- Reactions and reposts use the shared action summary renderer, so kind `7`
  content `+` or empty content renders as a heart reaction; rows do not expose
  raw reaction markers or repost JSON.
