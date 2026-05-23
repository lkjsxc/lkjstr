# Home Runtime

## Purpose

Home runtime owns active-account follow discovery and followed-note loading.

## Contract

- Load cached kind `3` follows and matching cached kind `1` notes first.
- Read cached pages through the shared repository.
- Build authors from active account plus latest follow-list `p` tags.
- Deduplicate authors and chunk author filters when needed.
- Keep Home to a `180` item in-memory window.
- Load older pages through `loadOlder()` from the bottom cursor.
- Load newer pages through `loadNewer()` from the top cursor when newer
  resident chunks were pruned.
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
  reads keep the selected fallback path immediate, while older and live reads
  may add route evidence.
- Use selected read relays as base and fallback, then add bounded author routes
  from NIP-65, NIP-02, relay receipts, and discovery evidence.
- Do not fall back to disabled, removed, or hidden relays.
- Do not subscribe when there is no active account.
- Stop loading when a page is filled, all scanned windows reach terminal EOSE
  completion, or an incomplete relay window requires conservative `hasOlder`.
  Missing detailed page status is incomplete for adaptive feed scans.
- Expose `no-active-account`, `loading-follows`, `no-follow-list`,
  `no-enabled-relay`, `auth-required`, `subscription-closed`, `relay-failed`,
  `ready-empty`, and `ready-with-events`.
- Surface relay `CLOSED`, `NOTICE`, `AUTH`, message parse errors, invalid event
  signatures, startup failures, and async listener failures through lkjstr Log.
- Close old subscriptions when the primitive runtime key changes or the tab
  closes. The key is tab kind, active account pubkey, sorted normalized relays,
  and tab id.
