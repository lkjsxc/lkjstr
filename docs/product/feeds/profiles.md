# Profiles

## Purpose

Profile tabs show identity metadata and authored text notes.

## Contract

- Profile tabs open from identity actions, not New Tab.
- The tab receives a hex pubkey from the workspace command.
- Runtime loads cached metadata and notes before relay data.
- Metadata cache reads are latest-only and consult memory before IndexedDB.
  Older metadata events must never replace newer profile metadata.
- Selected read relays are the base and fallback. Profile may also use the
  author's NIP-65 write relays, NIP-02 hints, event receipts, and discovery
  evidence. Disabled or removed relays remain excluded.
- Profile performs split initial metadata, follow-list, and note relay reads.
  Metadata and follow-list reads keep exact filters; visible notes use bounded
  `since`/`until` scan windows, then live subscriptions use startup `since`.
- Only authored feed-display events consume visible note page slots.
- Initial and older note pages request `30` items.
- Profile note lists keep a `180` item window.
- Profile renders as one virtual timeline flow. The header, error row, empty
  state, note rows, and footer rows share the same virtual feed list.
- Profile does not show a visible initial loading row or manual load-newer
  control. Loading and newer state remain internal runtime state.
- Older note pages use `max(1200px, 2 x viewport)` near-end detection and
  shared `FeedSurfaceStatus` footer semantics.
- Profile metadata supports banner, picture, display name, name, NIP-05,
  website, Lightning address, and about text.
- Profile header identity content starts below the avatar/action row. Display
  name, subtitle, full `npub`, facts, and about text share one content width.
  The avatar may overlap banner media, but text and notes never overlap the
  banner.
- Website values and safe HTTP, HTTPS, or schemeless domain-like URLs inside
  about text render as clickable links after HTTP/HTTPS normalization.
  Unsafe schemes such as `javascript:` never render as links.
- Profile note lists display kinds `1`, `6`, and `16`.
- Profile about text and display names render valid HTTPS custom emoji tags.
  Unknown, invalid, or failed-image emoji stays visible as shortcode text.
- Sensitive authored rows use the same reveal gate as Home and Global.
- Profile displays banner media when metadata provides `banner`.
- Profile editing is not inline. Own-profile actions open Profile Edit in the
  same tile.
- Profile Edit merges with the latest cached kind `0` metadata. Blank known
  fields delete those keys; unknown keys, `lud06`, and matching latest profile
  custom emoji tags remain preserved.
- Successful Profile Edit publishes kind `0` to enabled write relays, stores
  the result locally, and notifies open Profile tabs to refresh.
- Notes must not render through a dedicated full-height child scroller.
- Profile identity surfaces show display name, subtitle, and the full `npub`.
  A three-dot menu can copy `npub`, `nprofile`, follow-list JSON, and
  registered relay-set JSON.
- Profile hides `nprofile`, loaded-post count, and diagnostic metadata relay
  count from visible facts.
- Profile `nprofile` relay hints use selected enabled default read relays.
- Follow-list JSON is the latest viewed profile kind `3` event or `null`.
- Registered relay-set JSON includes all configured relay sets with normalized
  relay URL plus relay enabled, read, and write flags.
- Profile shows following count as a button when the viewed profile's latest
  kind `3` is known.
- Clicking the following count opens or focuses the Followees tab for the
  viewed pubkey in the same tile.
- Following count state is explicit: `loading-cache`, `discovering-relays`,
  `known`, `known-empty`, `incomplete`, `unavailable`, and `failed`.
- Unknown or discovering follow lists show stable text such as `Loading
following...` or `Calculating following...`, not `0 following`.
- A known empty follow list shows `0 following`. Partial failure, timeout,
  relay `AUTH`, socket close, or missing EOSE shows incomplete or unavailable
  diagnostics and never invents a count.
- Long `about`, `npub`, and website values wrap without overlapping the Notes
  section at desktop, mobile, or narrow split-pane widths.
- Profile note rows start below the full profile header inside the same scroll
  owner.
- Older profile notes use bounded viewport-fill while the list is underfilled,
  then load only when a current downward user gesture on the scroll owner
  reaches the bottom threshold. Observer-only near-end callbacks must not prune
  newer profile rows after the list is scrollable.
- Scroll position automatically restores per Profile tab after tab switching and
  reload.
- Profile note state is one of `metadata-loading`, `notes-loading-recent`,
  `notes-searching-older`, `notes-partial`, `notes-ready-with-events`,
  `notes-ready-empty-proven`, `notes-unavailable`, `notes-auth-required`, or
  `notes-all-relays-failed`.
- The old copy `No notes have been received for this profile.` is not shown
  while cache or relay evidence is incomplete. Empty copy is allowed only in
  `notes-ready-empty-proven` and must mention attempted public relays.
- Initial and historical note pages use compound `{createdAt,id}` cursors,
  adaptive bounded windows with `since` and `until`, local relay boundary
  filtering, and merged relay provenance. Sparse complete windows keep scanning
  older; dense or incomplete windows remain non-exhaustive.
- Sparse historical scans start with recent bounded windows. Complete empty
  windows widen or step older toward `created_at = 0` without unbounded relay
  requests. Progress text may include the oldest checked year.
- Metadata and follow-list rendering do not block on the note scan. Note-scan
  cancellation happens when the tab closes or its generation changes.
- Scanner-owned bounds are enforced at relay dispatch. A relay-effective limit
  smaller than the visible page size is dense when it fills.
- Repeated stale bottom triggers must not queue unbounded older reads or keep
  pruning newer rows after the first downward history request.
- When older scrolling prunes newer notes, Profile stores newer notes out of
  view and recovers them automatically when the profile card returns to the top
  of the scroll owner with a dedicated newer relay read id.
- Live authored posts received while viewing an older pruned window are stored
  but not inserted visibly until newer notes are loaded.
- Live relay reads set `since` when the profile runtime starts.
- Closing the tab closes profile subscriptions.
- Mention and event tokens inside profile notes use the shared post renderer and
  open Profile or Thread in the same tile.
