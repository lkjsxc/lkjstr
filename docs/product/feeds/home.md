# Home

## Purpose

Home is the account-follow feed. It shows notes from the selected account and
its NIP-02 follows.

## Contract

- Home opens from New Tab and as one of the default work tabs at startup.
- Home is cache-first. It must render cached matching notes as soon as account
  and relay page data have loaded, before profile hydration and before relay
  results.
- After authors are known, Home performs an immediate selected-relay initial
  scan with bounded `since`/`until` windows, discovers routes in parallel, then
  keeps live subscriptions bounded with startup `since`.
- Account home authors are the active account plus `p` tags from the latest
  kind `3` follow list. Cache reads for the follow list use an indexed
  latest-only kind `3` lookup for the active pubkey.
- Home displays event kinds `1`, `6`, and `16`; cache queries and relay
  filters must not include other feed kinds.
- Selected read relays are the base and fallback. Home may also use NIP-65
  author write relays, NIP-02 follow hints, relay receipts, and discovery
  evidence. Disabled or removed relays remain excluded.
- Relay reads go through the subscription orchestrator (route plan, shared leases,
  semantic page dedupe); the manager multiplexes wire traffic below the planner.
- Events and relay provenance are written through the shared repository.
- Initial and older pages request `30` items.
- The tab keeps a `180` item window and exposes jump to latest after newer
  items are pruned.
- Live events are retained only inside the same `180` item window.
- Older pages load after near-bottom scroll using
  `max(1200px, 1.5 x viewport)` or an equivalent sentinel margin, or when the
  loaded rows are shorter than the viewport and `hasOlder` remains true.
- One speculative older page may prefetch when near end while `hasOlder` is
  true. See [feed-surface.md](../../architecture/data/feed-surface.md).
- Older pages render event shells immediately; profile and reference enrichment
  continue asynchronously.
- Initial and historical relay pages use compound `{createdAt,id}` cursors and
  adaptive bounded windows with both `since` and `until`. Empty complete
  windows continue older; incomplete or dense windows keep `hasOlder`
  conservative.
- Newer catch-up reads cache and relays from the newest bounded segment toward
  the top cursor.
- Home does not start automatic session backfill on open. Older history loads
  after scroll or explicit page requests.
- Adaptive feed requests remain bounded even if a route-specific filter omits
  the provided scan bounds. Missing detailed relay status is treated as
  incomplete.
- Relay results are deterministic event rows. Duplicate events from multiple
  relays render once with merged relay provenance.
- Live relay reads set `since = max(0, runtimeStartedAt - 30)` when the runtime starts.
- Metadata fetches are limited to authors present in loaded items.
- Deleted or disabled relays are not replaced by hidden public defaults.
- No active account means no relay subscription. Home must not enter
  `no-active-account` while workspace account data is still loading.
- No follow list after follow-discovery completion means an empty feed with
  explicit guidance. Missing follows must be finalized only from the
  follow-list kind `3` subscription/read result across the intended relay
  set, not from unrelated subscription `EOSE` state. Home must not start a
  self-only relay scan as a silent fallback.
  See [home source](../../architecture/feeds/sources/home.md).
- While follows are loading, Home must not issue notes filters with only the
  active pubkey.
- Loading ends when cached or initial relay data exists, contacted relays finish
  or fail, or a live relay produces matching events.
- A failed relay remains diagnostic and must not block other relays.
- Relay `CLOSED`, `NOTICE`, `AUTH`, parse failure, and invalid signatures are
  visible in lkjstr Log, not inline in the timeline body.
- The timeline body keeps high-level state errors visible, such as unreachable
  relays or authentication requirements.
- Author controls open or focus matching Profile tabs in the same tile.
- Event rows, quotes, and references open or focus matching Thread tabs in the
  same tile. Empty event ids must never open a Thread tab.
- Post rows do not show relay source text or full public-key text.
- Post rows do not use a left-side new-event stripe. Live inserts change order
  only; they do not add a freshness accent on the row edge.
- Post rows do not show short event ids in row metadata.
- Media URLs that successfully render as image, video, or audio embeds are
  hidden from the text body. Other HTTPS URLs remain visible links.
- `nostr:npub` and `nostr:nprofile` content tokens open or focus Profile in the
  same tile. `nostr:note` and `nostr:nevent` tokens open or focus Thread in the
  same tile.
- Quote and reference previews are deduped by event id and resolved in one
  local id batch plus one relay id batch per row. First four previews are
  visible; remaining previews stay behind Show all references.
- Reply-root references must not be labeled `Thread root` in visible rows.
- Sensitive rows show only warning metadata and local reveal controls until
  revealed. Hidden media and custom emoji images must not preload.

## States

- `no-active-account`: cache only; account action required.
- `loading-follows`: active account exists and follow discovery or notes load.
- `no-follow-list`: latest kind `3` is absent; empty feed with guidance and a
  **Check relays again** control; no self-only relay scan.
- `no-enabled-relay`: selected set has no enabled read relay.
- `auth-required`: a relay sent `AUTH`.
- `subscription-closed`: a relay sent `CLOSED`.
- `relay-failed`: selected relays are unreachable.
- `ready-empty`: relay EOSE completed with no matching notes.
- `ready-with-events`: cache or relay data has matching notes.
- `loadingOlder`: an older cache or relay page is being requested.
- `hasOlder`: more older cached or relay-backed items may exist.
- `hasNewer`: newer resident chunks or relay catch-up can be loaded from the
  top cursor.
