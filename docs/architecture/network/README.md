# Network Architecture

## Purpose

Network docs define relay behavior, jobs, settings state, identity hydration,
and app boundaries.

## Documents

- [identity-rendering.md](identity-rendering.md): names and avatars.
- [job-manager.md](job-manager.md): persisted job state and cancellation.
- [relay-pool.md](relay-pool.md): relay client pool.
- [relay-routing.md](relay-routing.md): protocol-derived read routing.
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
- [subscription-orchestration/owner-visibility.md](subscription-orchestration/owner-visibility.md):
  hidden tab behavior.
- [subscription-orchestration/page-read-dedupe.md](subscription-orchestration/page-read-dedupe.md):
  semantic page keys.
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
- Selected read relays are the base and fallback; targeted reads may add
  bounded protocol-derived routes unless the URL is disabled or removed.
- Session diagnostics retain relay URL, optional subscription id, kind,
  message, and timestamp.
- No app code installs SES lockdown behavior.
