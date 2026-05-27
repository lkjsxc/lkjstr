# Home Query Lifecycle

## Purpose

Define shared Home query startup, paging, refresh, and cleanup.

## Contract

- `attachHomeQuery(input)` returns `subscribe`, `setVisibility`, `loadOlder`,
  `loadNewer`, `refresh`, `retryFollowDiscovery`, `snapshot`, and `close`.
- Matching Home tabs attach to one query keyed by active account, selected read
  relays, page size, and feed policy.
- The first attachment warms cache and starts at most one follow discovery, one
  notes bootstrap, one route discovery cycle, one notes live lease, and one
  follow-list live lease.
- Warm attachments render the current snapshot and do not issue extra initial
  page reads or route refresh reads.
- Home note filters share one page budget across author chunks for initial,
  older, newer, and live startup paths.
- Route discovery refresh reads run only when the resolved route-group
  fingerprint changes.
