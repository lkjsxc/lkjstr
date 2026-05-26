# Notifications Runtime

## Purpose

Notifications runtime owns active-account notification indexing and relay
backfill.

## Contract

- Load local notification records before relying on relay events.
- The Notifications tab runtime owns notification relay sync for supported
  active-account `#p` events: kinds `0`, `1`, `6`, `7`, `16`, and `9735`.
- Notifications tab relay pages use the shared `30` item feed page size.
- Store notification source events through the shared repository.
- Resolve target/root event context from the shared repository only as
  explicitly labeled fallback content when the source notification event is
  unavailable.
- Source event rows are canonical `EventRow` renders. The row-level actor chip
  is presentation context only and is hidden when
  `sourceEvent.pubkey === record.actorPubkey`.
- Fallback target/root rows keep the row-level actor chip because fallback
  authors can differ from the notification actor.
- Derive notification records from stored events.
- Keep Notifications source event and fallback target context state to a
  `180` notification record window. Prune by record count, not resolved event
  count.
- Notifications use the shared virtual feed list, `FeedSurfaceStatus`, and
  speculative older prefetch per [feed-surface.md](../data/feed-surface.md).
- Retain only source and target/root events referenced by retained
  notification records.
- Missing source notification events remain visible as compact unavailable rows
  and may show labeled target/root fallback context.
- Older pages load local records first, then one bounded relay page when a
  cursor exists.
- The Notifications tab is a plain scroll flow. It prefetches near the bottom,
  guards duplicate older loads, shows loading status while `loadingOlder &&
hasOlder`, and auto-fills older pages when rows do not fill the viewport.
- Terminal history appears only when `hasOlder === false`.
- Historical relay pages use the oldest loaded event time to build interval
  windows with both `since` and `until`.
- Live relay reads set `since` when the runtime starts.
- Mark visible records read only when the Notifications tab is visible and the
  window is focused.
- No active account or no enabled read relays settles loading without opening
  hidden relay connections.
- Use selected read relays as base and fallback plus the active account's
  NIP-65 read relays for account notification reads.
- Close subscriptions when relay settings change or the tab closes, and abort
  in-flight or queued initial and older notification relay page reads.
