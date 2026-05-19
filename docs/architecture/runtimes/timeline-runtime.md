# Home Runtime

## Purpose

Home runtime owns account-follow loading.

## Contract

- Load cached kind `3` follows and matching cached kind `1` notes first.
- Read cached pages through the shared repository.
- Build authors from active account plus latest follow-list `p` tags.
- Deduplicate authors and chunk author filters when needed.
- Keep Home and Global to a `180` item in-memory window.
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
- Use enabled read relays from the selected default relay set.
- Do not fall back to disabled, deleted, or hidden relays.
- Do not subscribe when there is no active account.
- Stop loading when all active relays send EOSE, including zero-event reads.
- Expose `no-active-account`, `loading-follows`, `no-follow-list`,
  `no-enabled-relay`, `auth-required`, `subscription-closed`, `relay-failed`,
  `ready-empty`, and `ready-with-events`.
- Surface relay `CLOSED`, `NOTICE`, `AUTH`, message parse errors, invalid event
  signatures, startup failures, and async listener failures through lkjstr Log.
- Close old subscriptions when relay settings change or the tab closes.
