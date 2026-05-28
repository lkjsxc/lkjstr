# Subscription Orchestration

## Purpose

Document the browser-local planner between feed runtimes and relay pool traffic.

## Principle

Runtimes state **what** they need (intent). The orchestrator alone decides **how**
to talk to relays (route plan, wire request, lease key, REQ/CLOSE).

## Table of Contents

- [demand-intent.md](demand-intent.md): intent shapes; owner vs dedupe key
- [route-plan.md](route-plan.md): relay planning ownership
- [lease-key.md](lease-key.md): wire-equivalent fingerprints
- [live-lease.md](live-lease.md): refcount and suspend/resume
- [page-read-dedupe.md](page-read-dedupe.md): semantic page keys
- [owner-visibility.md](owner-visibility.md): hidden tabs and pane churn
- [ingress.md](ingress.md): live event classification
- [metrics.md](metrics.md): counters and gauges
- [home-integration.md](home-integration.md): Home bootstrap, live, paging
- [notifications-profile-thread-integration.md](notifications-profile-thread-integration.md): other surfaces
- [routing-by-surface.md](routing-by-surface.md): per-surface relay tables
- [compatibility.md](compatibility.md): when intents merge
- [source-map.md](source-map.md): code map
- [tests.md](tests.md): verification gates

Older topic files were folded into the documents listed above.

## Related

- [../relay-pool.md](../relay-pool.md)
- [../subscription-manager.md](../subscription-manager.md)
- [../relay-routing.md](../relay-routing.md)
- [../system.md](../system.md)
- [../../runtimes/README.md](../../runtimes/README.md)

## Rules

- Tab and pane components never call `REQ` or `CLOSE` directly.
- Lease fingerprints exclude tab ids and owner handles.
- Bootstrap and page reads use semantic dedupe keys.
- Hidden feed tabs release live intents; cached windows remain until close.
