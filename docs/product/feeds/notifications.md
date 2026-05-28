# Notifications

## Purpose

The Notifications tab shows relay-backed account activity with a lightweight
notification context header and the source event as the primary body.

## Contract

- The tab opens from New Tab.
- Records are scoped to the active account pubkey.
- Relay filters use `#p: [activePubkey]` for targeting events at the account.
  Notification filters must not reuse Home `authors` semantics. See
  [notifications source](../../architecture/feeds/sources/notifications.md).
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
- Notification relay window constants (seconds):
  - `notificationInitialLookbackSeconds = 720` (12 minutes)
  - `notificationOlderPageLookbackSeconds = 720` (12 minutes)
  - `notificationClockSkewSeconds = 120`
- Initial relay read bounds:
  - `since = max(0, runtimeStartedAt - notificationInitialLookbackSeconds)`
  - `until = runtimeStartedAt + notificationClockSkewSeconds`
  - The initial relay filter must include both `since` and `until`.
- Older relay paging bounds (bounded segment scan):
  - Let `oldest = oldestLoadedNotificationRecord.createdAt`
  - `since = max(0, oldest - notificationOlderPageLookbackSeconds)`
  - `until = max(0, oldest - 1)`
- No automatic deep backfill on tab open: older pages must not be requested
  during initial settle or just because the viewport is not filled. Older
  requests are allowed only from a current downward user scroll-owner gesture
  (or an explicit older action), using the shared feed surface near-end
  semantics. Earlier scrolling must not unlock observer-only or viewport-fill
  triggers.
- Older notifications load after near-bottom scroll using
  `max(1200px, 2 x viewport)` or an equivalent sentinel margin.
- Feed surface may issue speculative older prefetches in general, but
  Notifications use an older-load guard and must not auto-fill history during
  initial settle.
- Shared `FeedSurfaceStatus` footer shows loading, end of history, and errors.
- Notifications use `FeedScrollSurface` with Virtua on
  `.notification-list-scroll`, the same near-end and footer semantics as Home
  and Global. See [feed-scroll-surface.md](../../architecture/data/feed-surface/feed-scroll-surface.md).
- The tab root uses `.feed-tab` with `overflow: hidden`. Only
  `.notification-list-scroll` scrolls vertically (`data-scroll-owner`).
- Exactly one bottom border separates notification items. Embedded `EventRow`
  uses `showSeparator={false}`. See
  [feed-row-chrome.md](../../architecture/data/feed-surface/feed-row-chrome.md).
- Historical relay pages use interval windows with `since` and `until` from
  the oldest loaded notification record (`created_at`).
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
