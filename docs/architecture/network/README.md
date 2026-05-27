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
- [system.md](system.md): app boundaries.

## Shared Contract

- Failed relays remain diagnostic and do not block reachable relay reads.
- Selected read relays are the base and fallback; targeted reads may add
  bounded protocol-derived routes unless the URL is disabled or removed.
- Session diagnostics retain relay URL, optional subscription id, kind,
  message, and timestamp.
- No app code installs SES lockdown behavior.
