# Stats

## Purpose

Stats shows current-session relay counters and persisted operational summaries.

## Contract

- Stats opens from New Tab as the `network-stats` tab kind.
- It reads relay snapshots, cache status, persisted relay summaries, persisted
  job health, and runtime counters.
- It never creates relay subscriptions or changes relay settings.
- Manual refresh is always available.
- Optional auto-refresh polls every two seconds while enabled.
- Relay totals include open relays, active subscriptions, events, OK accepts,
  OK rejects, and sent plus received bytes.
- Relay diagnostics include local request caps, clamp reasons, NIP-11 stale or
  unavailable state, auth/payment/restriction warnings, timeouts, and
  event-limit reached state when known.
- Subscription rows use human-purpose labels such as Home live feed, Profile
  page read, Notifications live, Metadata, or Route discovery. Redacted raw ids
  are secondary only.
- Stats distinguishes raw relay wire subscriptions from orchestration counters:
  active demands, active leases, live leases, bootstrap/page reads, and
  in-flight reads.
- Cache status includes event, profile, notification, site budget bytes,
  browser usage, ledger bytes, prunable cache bytes, protected user estimate,
  unknown/browser overhead, ledger inventory by resource kind, last enforcement
  reason, pruned resource count, pruned byte estimate, and protected-only or
  unknown-only status.
- Runtime memory shows compact app-owned counters: app log count, relay
  suppression count, in-flight reads, fallback repository counts, reference
  cache size, profile cache size, token cache size, relay snapshot totals,
  orchestration demand and lease counts (active, live, bootstrap), relay REQ and
  CLOSE totals, events received vs accepted vs dropped, and optional JavaScript
  heap.
- Runtime memory output is redacted count data only. It must not expose raw
  events, relay payloads, tab ids, request ids, or log messages.
