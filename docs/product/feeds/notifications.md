# Notifications

## Purpose

The Notifications tab shows relay-backed account activity with a lightweight
notification context header and the source event as the primary body.

## Contract

- The tab opens from New Tab.
- Records are scoped to the active account pubkey. Notifications is a protected
  account surface and may read relays only after a real selected account pubkey
  exists.
- Relay filters use `#p: [activePubkey]` for targeting events at the account.
  Notification filters must not reuse Home `authors` semantics. See
  [notifications source](../../architecture/feeds/sources/notifications.md).
- Mentions, replies, reactions, reposts, quotes, profile references, and zap
  receipts are indexed.
- Profile references are indexed when metadata points at the active account.
- Selected read relays are the durable base and fallback. If relay settings are
  unavailable and a real active pubkey is supplied by the page shell,
  Notifications may use documented session default public relays in read-only
  mode with a visible diagnostic. Notifications may also use the active account's
  NIP-65 read relays for `#p` reads and selected fallback for context.
- Notification events are written through the shared repository.
- Notifications tab initial and older pages request `30` records.
- Notification relay sync starts when the Notifications tab is opened.
- Bootstrap and historical relay pages use the shared adaptive grouped scanner
  with a one-minute initial segment.
- Notification tabs keep a `180` record window. Windowing is based on
  notification records, not the number of resolved source events.
- The tab scans a bounded recent relay window on open. If the first window has
  zero records, the scroll surface remains mounted and shows older-read or
  relay-reading status so older scans can continue.
- No automatic deep backfill on tab open: viewport-fill stops once the list
  becomes scrollable, history is proven exhausted, or the bounded attempt cap is
  reached. After that, older requests require a downward scroll-owner gesture or
  the explicit `Load older notifications` command.
- Older notifications load after near-bottom scroll using
  `max(1200px, 2 x viewport)` or an equivalent sentinel margin.
- Sparse empty relay windows advance `olderCursorCreatedAt` and must not render
  `End of known history.` unless the lower bound is reached with complete,
  unambiguous relay status and no local older records.
- Dense, incomplete, unresolved, failed, missing, or compacted coverage cannot
  suppress notification relay reads or prove that older notifications are absent.
- Shared `FeedSurfaceStatus` footer shows loading, end of history, and errors.
  End of history appears only for proven exhaustion.
- Rust pending provider work renders a loading status until cached records,
  progressive relay records, EOSE, or terminal relay failure provides real
  evidence.
- The empty notification message appears only after history exhaustion is
  proven, not merely because the initial window returned zero records.
- Notifications use `FeedScrollSurface` with Virtua on
  `.notification-list-scroll`, the same near-end and footer semantics as Home
  and Global. See [feed-scroll-surface.md](../../architecture/data/feed-surface/feed-scroll-surface.md).
- The tab root uses `.feed-tab` with `overflow: hidden`. Only
  `.notification-list-scroll` scrolls vertically (`data-scroll-owner`).
- Scroll position automatically restores per tab after tab switching and reload.
- Exactly one bottom border separates notification items. Embedded `EventRow`
  uses `showSeparator={false}`. See
  [feed-row-chrome.md](../../architecture/data/feed-surface/feed-row-chrome.md).
- Notifications have no user-visible read or unread state. There is no unread
  stripe, no screen-reader-only unread label, and no transient unread flash.
- Opening, focusing, or viewing Notifications does not mutate notification rows
  merely to mark them read.
- Account storage busy, account storage blocked or unsupported, selector
  unavailable, and loading states render explicit protected-account guidance and
  do not collapse to `no-active-account`. If the page shell already supplied the
  active account pubkey, Notifications may continue with that real pubkey while
  keeping the Rust storage failure as a diagnostic.
- Initial loading settles after local records load and subscription setup
  finishes, even when no notification event arrives.
- Partial relay failure and session-default fallback diagnostics stay visible
  but do not block cached or reachable notification records.
- `no-active-account` is reserved for readable account state proving no account
  exists or no account is selected. It is not used for `opfs-owner-held`, Web
  Lock denial, unsupported storage, or selector read failures.
- Empty state is explicit only after no records exist and account, cache, relay,
  and bounded history exhaustion are proven.
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
