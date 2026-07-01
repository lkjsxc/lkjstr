# Network Architecture

## Purpose

Network docs define relay behavior, jobs, settings state, identity hydration,
and app boundaries.

## Table of Contents

- [identity-rendering.md](identity-rendering.md): names and avatars.
- [job-manager.md](job-manager.md): persisted job state and cancellation.
- [relay-pool.md](relay-pool.md): relay client pool.
- [progressive-relay-rendering.md](progressive-relay-rendering.md):
  progressive read snapshots, coverage, and UI merge contract.
- [public-read-relays.md](public-read-relays.md): session default relays for
  public read-only surfaces when durable relay settings are unavailable.
- [read-availability/README.md](read-availability/README.md): typed effective
  read plans for durable, fallback, unavailable, and write-boundary states.
- [read-availability/effective-plan.md](read-availability/effective-plan.md):
  effective read plan fields.
- [read-availability/surface-policy.md](read-availability/surface-policy.md):
  read-only fallback policy by surface.
- [relay-routing.md](relay-routing.md): protocol-derived read routing.
- [relay-optimizer/README.md](relay-optimizer/README.md): measured relay
  scoring, route trust, scan hints, wait policy, and Stats projection.
- [relay-optimizer/measurement-ledger.md](relay-optimizer/measurement-ledger.md):
  optimizer storage rows.
- [relay-optimizer/product-wiring-ledger.md](relay-optimizer/product-wiring-ledger.md):
  shipped surface wiring.
- [relay-optimizer/source-map.md](relay-optimizer/source-map.md): source paths
  and proof files.
- [relay-optimizer/implementation-slices.md](relay-optimizer/implementation-slices.md):
  work slices and focused gates.
- [relay-optimizer/failure-states.md](relay-optimizer/failure-states.md): typed
  optimizer unavailable states.
- [relay-optimizer/relay-read-scoring.md](relay-optimizer/relay-read-scoring.md):
  Rust score model.
- [relay-optimizer/relay-wait-policy.md](relay-optimizer/relay-wait-policy.md):
  first paint and late merge.
- [relay-optimizer/route-evidence-trust.md](relay-optimizer/route-evidence-trust.md):
  source trust.
- [relay-optimizer/scan-width-adaptation.md](relay-optimizer/scan-width-adaptation.md):
  scan learning.
- [relay-optimizer/stats-projection.md](relay-optimizer/stats-projection.md):
  Stats rows.
- [relay-optimizer/verification.md](relay-optimizer/verification.md): checks.
- [request-budget/README.md](request-budget/README.md): request limits,
  NIP-11 bounds, and diagnostics.
- [request-budget/effective-limits.md](request-budget/effective-limits.md):
  limit derivation.
- [request-budget/intent.md](request-budget/intent.md): budget intent fields.
- [request-budget/message-size.md](request-budget/message-size.md): outbound
  request bytes.
- [request-budget/nip11.md](request-budget/nip11.md): relay information budget
  data.
- [request-budget/scoring.md](request-budget/scoring.md): score boundary.
- [request-budget/source-map.md](request-budget/source-map.md): code map.
- [request-budget/tests.md](request-budget/tests.md): verification gates.
- [settings-store.md](settings-store.md): flat settings storage.
- [subscription-manager.md](subscription-manager.md): shared relay reads.
- [subscription-orchestration/README.md](subscription-orchestration/README.md):
  Demand, Lease, bootstrap/live, routing, observability.
- [subscription-orchestration/demand-intent.md](subscription-orchestration/demand-intent.md): intent shapes.
- [subscription-orchestration/home-integration.md](subscription-orchestration/home-integration.md):
  Home bootstrap, live, and paging.
- [subscription-orchestration/ingress.md](subscription-orchestration/ingress.md):
  live event classification.
- [subscription-orchestration/lease-key.md](subscription-orchestration/lease-key.md):
  wire-equivalent fingerprints.
- [subscription-orchestration/live-lease.md](subscription-orchestration/live-lease.md):
  lease refcount and visibility.
- [subscription-orchestration/metrics.md](subscription-orchestration/metrics.md):
  orchestration counters.
- [subscription-orchestration/notifications-profile-thread-integration.md](subscription-orchestration/notifications-profile-thread-integration.md):
  other feed surfaces.
- [subscription-orchestration/feed-route-isolation.md](subscription-orchestration/feed-route-isolation.md):
  route fingerprints and cross-surface isolation.
- [subscription-orchestration/owner-visibility.md](subscription-orchestration/owner-visibility.md):
  hidden tab behavior.
- [subscription-orchestration/page-read-dedupe.md](subscription-orchestration/page-read-dedupe.md):
  semantic page keys.
- [subscription-orchestration/relay-read-scoring.md](subscription-orchestration/relay-read-scoring.md):
  relay plus request-context scheduling scores.
- [subscription-orchestration/route-plan.md](subscription-orchestration/route-plan.md):
  relay route planning.
- [subscription-orchestration/tests.md](subscription-orchestration/tests.md):
  verification gates.
- [subscription-orchestration/compatibility.md](subscription-orchestration/compatibility.md):
  Demand merge rules.
- [subscription-orchestration/routing-by-surface.md](subscription-orchestration/routing-by-surface.md):
  per-surface relay routes.
- [subscription-orchestration/source-map.md](subscription-orchestration/source-map.md):
  implementation modules.
- [system.md](system.md): app boundaries.

## Shared Contract

- Failed relays remain diagnostic and do not block reachable relay reads.
- Relay reads expose cache-first and partial snapshots without changing final
  result compatibility.
- Relay optimizer state is advisory and measurement-first. It orders enabled
  attempts, records bounded diagnostics, and exposes Stats rows, but it never
  proves cache absence.
- Selected read relays are the base and fallback; targeted reads may add
  bounded protocol-derived routes unless the URL is disabled or removed.
- Public and allowed protected read-only surfaces may use documented session
  default read relays when durable relay settings are unavailable, with visible
  diagnostics and no write capability.
- Session diagnostics retain relay URL, optional subscription id, kind,
  message, and timestamp.
- No app code installs SES lockdown behavior.
