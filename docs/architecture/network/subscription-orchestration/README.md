# Subscription Orchestration

## Purpose

Subscription orchestration is the browser-local planner between tab runtimes
and the relay pool. Surfaces submit **Demands**; the planner holds shared
**Leases** that map to multiplexed `REQ` and `CLOSE` traffic on one WebSocket
per relay URL.

## Documents

- [demand.md](demand.md): Demand shape, phases, owners, visibility.
- [lease.md](lease.md): Lease shape, refcount, and `CLOSE` guarantees.
- [normalization.md](normalization.md): Canonical filters and stable hashes.
- [compatibility.md](compatibility.md): When Demands merge into one Lease.
- [bootstrap-live.md](bootstrap-live.md): Bootstrap vs live-tail lifecycle.
- [observability.md](observability.md): Counters, log events, Stats rules.
- [routing-by-surface.md](routing-by-surface.md): Per-surface relay targeting.
- [source-map.md](source-map.md): Implementation modules under `src/lib/relays/orchestration/`.

## Related

- [../relay-pool.md](../relay-pool.md): one client per relay URL.
- [../subscription-manager.md](../subscription-manager.md): listener-shared relay reads below the planner.
- [../relay-routing.md](../relay-routing.md): protocol-derived route evidence.
- [../system.md](../system.md): UI must not issue raw relay requests.
- [../../runtimes/README.md](../../runtimes/README.md): per-surface demand producers.

## Rules

- Tab and pane components never call `REQ` or `CLOSE` directly.
- Lease fingerprints exclude tab ids and owner handles.
- Bootstrap reads close on `EOSE`; live tails use forward `since` anchors.
- Hidden feed tabs release live Demands but may retain cached windows.
- Search, Custom Request, and Author Context use the same orchestrator with
  isolated Demand owners.
