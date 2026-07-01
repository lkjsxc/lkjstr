# Home

## Purpose

Home is the account-follow feed. It shows notes from the selected account and
its NIP-02 follows.

## Contract

- Home opens from New Tab and as one of the default work tabs at startup.
- Matching Home tabs attach to one browser-local backend query. The shared
  query owns cache warmup, follow discovery, bootstrap, live leases, route
  discovery, paging, profile hydration, snapshots, and cleanup.
- Tab ids are attachment owners only. They must not be part of the Home query
  key and must not cause duplicate bootstrap or route-refresh reads.
- Home is cache-first. It must render cached matching notes as soon as account
  and relay page data have loaded, before profile hydration and before relay
  results.
- After authors are known, the shared query performs an immediate
  selected-relay initial scan with bounded `since`/`until` windows, discovers
  routes, then keeps live subscriptions bounded with startup `since`.
- Account home authors are the active account plus `p` tags from the latest
  kind `3` follow list. Cache reads for the follow list use an indexed
  latest-only kind `3` lookup for the active pubkey. A cache or follow-list
  storage failure is incomplete evidence: with a real active pubkey and allowed
  read relays, Home keeps a visible diagnostic and runs bounded kind `3` relay
  discovery before `no-follow-list` or a terminal unavailable state.
- Home displays event kinds `1`, `6`, and `16`; cache queries and relay
  filters must not include other feed kinds.
- Selected read relays are the durable base and fallback. If relay settings are
  unavailable and a real active pubkey is supplied by the page shell, Home may
  use documented session default public relays in read-only mode with a visible
  diagnostic. Home may also use NIP-65 author write relays, NIP-02 follow hints,
  relay receipts, and discovery evidence. Disabled or removed relays remain
  excluded when durable settings are available.
- Relay reads go through the subscription orchestrator (route plan, shared leases,
  semantic page dedupe); the manager multiplexes wire traffic below the planner.
- Events and relay provenance are written through the shared repository.
- Initial, older, newer, and live startup filters share one `30` item budget
  across author chunks.
- The tab keeps a `180` item window and exposes jump to latest after newer
  items are pruned.
- Scroll position automatically restores per Home tab after tab switching and
  reload.
- Live events are retained only inside the same `180` item window.
- Older pages load after near-bottom scroll using
  `max(1200px, 2 x viewport)` or an equivalent sentinel margin, or when the
  loaded rows are shorter than the viewport and `hasOlder` remains true.
- One speculative older page may prefetch when near end while `hasOlder` is
  true. Home may start that prefetch once rows and cursors exist and the feed is
  already inside the near-end threshold. See
  [feed-surface.md](../../architecture/data/feed-surface.md).
- Older pages render event shells immediately; profile and reference enrichment
  continue asynchronously.
- Initial and historical relay pages use compound `{createdAt,id}` cursors and
  adaptive bounded windows with both `since` and `until`. Empty complete
  windows continue older; incomplete or dense windows keep `hasOlder`
  conservative.
- Newer catch-up reads cache and relays from the newest bounded segment toward
  the top cursor.
- Route discovery refreshes the initial page only when the resolved route-group
  fingerprint changes.
- Home does not start unbounded session backfill on open. Older history loads
  after scroll, explicit page requests, or bounded short-feed viewport-fill.
- Adaptive feed requests remain bounded even if a route-specific filter omits
  the provided scan bounds. Missing detailed relay status is treated as
  incomplete.
- Relay results are deterministic event rows. Duplicate events from multiple
  relays render once with merged relay provenance.
- Live relay reads set `since = max(0, runtimeStartedAt - 30)` when the runtime starts.
- Metadata fetches are limited to authors present in loaded items.
- Deleted or disabled relays are not replaced by hidden public defaults when
  durable relay settings are loaded. Session defaults are allowed only when
  relay settings are unavailable and the read-only fallback is diagnosed.
- Home is a protected account surface. It may start relay reads only after a
  real selected account pubkey is available. Account storage busy, selector
  unavailable, blocked, unsupported, or loading states render explicit retry or
  unavailable guidance instead of `no-active-account`. If the page shell already
  supplied the active account pubkey, Home may continue with that real pubkey
  while keeping the Rust storage failure as a diagnostic.
- No active account means no relay subscription. Home must not enter
  `no-active-account` while workspace account data is still loading or when
  protected storage failed before proving that no account is selected.
- No follow list after follow-discovery completion means an empty feed with
  explicit guidance. Missing follows must be finalized only from the
  follow-list kind `3` subscription/read result across the intended relay
  set, not from unrelated subscription `EOSE` state. Home must not start a
  self-only relay scan as a silent fallback.
  See [home source](../../architecture/feeds/sources/home.md).
- While follows are loading, Home must not issue notes filters with only the
  active pubkey. If the latest kind `3` is not cached, Home runs bounded
  selected-relay follow discovery before planning note filters.
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

- `no-active-account`: storage was readable enough to prove no account exists
  or no account is selected; no relay subscription starts.
- `account-storage-busy`: protected account storage is busy; retry guidance and
  storage diagnostics are visible; no relay subscription starts.
- `account-selector-unavailable`: account rows are readable but the selector is
  unavailable; no relay subscription starts.
- `loading-follows`: active account exists and follow discovery or notes load.
- `loading-feed`: follows are known and cache or relay provider work is still
  pending; this state must not render as ready before real cache or relay
  evidence arrives.
- `no-follow-list`: latest kind `3` is absent; empty feed with guidance and a
  **Check relays again** control; no self-only relay scan.
- `no-enabled-relay`: durable relay settings loaded and the selected set has no
  enabled read relay, or fallback policy forbids session defaults.
- `auth-required`: a relay sent `AUTH`.
- `subscription-closed`: a relay sent `CLOSED`.
- `relay-failed`: selected relays are unreachable.
- `ready-empty`: relay EOSE completed with no matching notes.
- `ready-with-events`: cache or relay data has matching notes.
- `loadingOlder`: an older cache or relay page is being requested.
- `hasOlder`: more older cached or relay-backed items may exist.
- `hasNewer`: newer resident chunks or relay catch-up can be loaded from the
  top cursor.
