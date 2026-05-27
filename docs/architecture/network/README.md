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
- [subscription-orchestration/bootstrap-live.md](subscription-orchestration/bootstrap-live.md):
  bootstrap vs live-tail lifecycle.
- [subscription-orchestration/compatibility.md](subscription-orchestration/compatibility.md):
  Demand merge rules.
- [subscription-orchestration/demand.md](subscription-orchestration/demand.md): Demand shape.
- [subscription-orchestration/lease.md](subscription-orchestration/lease.md): Lease refcount.
- [subscription-orchestration/normalization.md](subscription-orchestration/normalization.md):
  canonical filters.
- [subscription-orchestration/observability.md](subscription-orchestration/observability.md):
  orchestration counters.
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
