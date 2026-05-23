# Notifications

## Purpose

The Notifications tab shows relay-backed account activity with notification
context first and event content second.

## Contract

- The tab opens from New Tab.
- Records are scoped to the active account pubkey.
- Mentions, replies, reactions, reposts, quotes, profile references, and zap
  receipts are indexed.
- Profile references are indexed when metadata points at the active account.
- Relay reads use enabled read relays from the selected default relay set.
- Notification events are written through the shared repository.
- Initial and older pages request `30` records.
- Notification tabs keep a `180` item window.
- Older notifications load only after scrolling near the bottom.
- Historical relay pages use `until` from the oldest loaded notification
  event.
- Live relay reads set `since` when the notification runtime starts.
- Visible notifications are marked read when the tab is visible and receives
  focus. Background sync does not mark records read.
- Initial loading settles after local records load and subscription setup
  finishes, even when no notification event arrives.
- Partial relay failure stays visible in diagnostics but does not block cached
  or reachable notification records.
- Empty state is explicit when no records exist.
- Rows use a compact left-aligned actor/action row followed by wrapped compact
  shared event previews.
- Clicking a preview opens or focuses the correct Thread tab. Buttons and links
  inside the preview keep their local behavior.
- Reaction and repost rows show the same visible action label style as other
  notification rows and do not use avatar overlay badges.
- Action labels cover mention, reply, reaction, repost, quote, and
  profile-reference records.
- Long event content, ids, relay URLs, and context fields wrap within the row.
- Notification event row metadata does not show short event ids.
- Notification event content uses the shared renderer, including mention links,
  event links, media URL hiding, bounded media embeds, and deduped previews.
- Reactions and reposts use the shared action summary renderer, so notification
  rows do not expose raw reaction markers or repost JSON.
