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
- Profile renders as one scroll flow: summary first, then Notes rows in normal
  document order. The Profile tab is the only scroll container for this flow.
- Profile metadata supports banner, picture, display name, name, NIP-05,
  website, Lightning address, and about text.
- Profile header identity content starts below the banner. The avatar may
  overlap banner media, but display name, subtitle, full `npub`, actions,
  facts, about text, and notes never overlap the banner.
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
- Profile shows following count from the viewed profile's latest kind `3`.
- Long `about`, `npub`, and website values wrap without overlapping the Notes
  section at desktop, mobile, or narrow split-pane widths.
- Profile notes start below the full profile header.
- Older profile notes load after near-bottom scroll or viewport auto-fill.
- Initial and historical note pages use compound `{createdAt,id}` cursors,
  adaptive bounded windows with `since` and `until`, local relay boundary
  filtering, and merged relay provenance. Sparse complete windows keep scanning
  older; dense or incomplete windows remain non-exhaustive.
- Scanner-owned bounds are enforced at relay dispatch. A relay-effective limit
  smaller than the visible page size is dense when it fills.
- When older scrolling prunes newer notes, Profile shows a load-newer affordance
  above Notes and recovers newer notes from cache and relays with a dedicated
  newer relay read id.
- Live authored posts received while viewing an older pruned window are stored
  but not inserted visibly until newer notes are loaded.
- Live relay reads set `since` when the profile runtime starts.
- Closing the tab closes profile subscriptions.
- Mention and event tokens inside profile notes use the shared post renderer and
  open Profile or Thread in the same tile.
