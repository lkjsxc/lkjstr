# Home Runtime

## Purpose

Home runtime owns account-follow loading.

## Contract

- Load cached kind `3` follows and matching cached kind `1` notes first.
- Read cached pages through the shared repository.
- Build authors from active account plus latest follow-list `p` tags.
- Deduplicate authors and chunk author filters when needed.
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
- Surface relay `CLOSED`, `NOTICE`, `AUTH`, message parse errors, and invalid
  event signatures as diagnostics.
- Close old subscriptions when relay settings change or the tab closes.
