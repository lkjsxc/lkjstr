# Home Runtime

## Purpose

Home runtime owns active-account follow discovery and followed-note loading.

## Contract

- Load cached kind `3` follows and matching cached kind `1` notes first.
- Read cached pages through the shared repository.
- Build authors from active account plus latest follow-list `p` tags.
- Deduplicate authors and chunk author filters when needed.
- Keep Home to a `180` item in-memory window.
- Retain at most `180` live and cached Home rows even if relays stream more.
- Load older pages through `loadOlder()` from the bottom cursor.
- Shared feed surface lists show `FeedSurfaceStatus` while `loadingOlder &&
  hasOlder`, and only show terminal history when `hasOlder === false`.
- Older pages emit window rows before profile and reference enrichment finish.
- Speculative older prefetch may run once when near end while `hasOlder` is true.
- Load newer pages through `loadNewer()` from the top cursor when newer
  resident chunks were pruned. The newer page reads cache and relay catch-up
  before merging into the resident window.
- Expose `loadingOlder`, `hasOlder`, `loadingNewer`, `hasNewer`,
  `oldestCursor`, and `newestCursor`.
- Apply one total request budget across Home author chunks.
- Limit missing metadata loads to `30` authors from the current page.
- Subscribe to follow discovery before note reads when no cached follow list
  exists.
- Subscribe to kind `1` notes with explicit authors through the subscription
  manager.
- Write relay events and relay provenance through the shared repository.
- Initial, older, and newer relay pages are sorted by `{created_at,id}` and
  preserve duplicate relay provenance before merging into the feed window.
  Initial and historical Home feed reads use adaptive bounded scans; initial
  reads use cached route evidence plus selected fallback. Route discovery may
  trigger one bounded current-window refresh, but selected fallback remains
  base coverage.
- `oldestCursor` and `newestCursor` are display boundaries. Private relay scan
  cursors drive older relay reads when safe relay coverage requires overlap.
- Use selected read relays as base and fallback, then add bounded author routes
  from NIP-65, NIP-02, relay receipts, and discovery evidence.
- Do not fall back to disabled, removed, or hidden relays.
- Do not subscribe when there is no active account.
- Stop loading when a page is filled, all adaptive segments reach terminal EOSE
  completion, or an unresolved relay segment requires conservative `hasOlder`.
  Missing detailed page status is incomplete for adaptive feed scans.
- Home does not start automatic session backfill on open. Older history loads by
  scroll-driven or explicit page requests.
- Do not show terminal history state while the most recent relay scan is
  incomplete.
- Expose `no-active-account`, `loading-follows`, `no-follow-list`,
  `no-enabled-relay`, `auth-required`, `subscription-closed`, `relay-failed`,
  `ready-empty`, and `ready-with-events`.
- Surface relay `CLOSED`, `NOTICE`, `AUTH`, message parse errors, invalid event
  signatures, startup failures, and async listener failures through lkjstr Log.
- Close old subscriptions when the primitive runtime key changes or the tab
  closes. The key is tab kind, active account pubkey, sorted normalized relays,
  and tab id.
- Runtime close aborts in-flight and queued initial, older, newer, route
  refresh, and metadata relay page reads before ignoring async continuations.
