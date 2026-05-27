# Route Plan

## Purpose

The orchestrator owns relay route planning. Runtimes supply selected relays and
author sets; the planner resolves NIP-65 routes, receipts, discovery, and
per-surface widening.

## Modules

| Code                                              | Role                                    |
| ------------------------------------------------- | --------------------------------------- |
| `src/lib/relays/relay-routing.ts`                 | NIP-65 groups, paging groups, discovery |
| `src/lib/relays/relay-discovery.ts`               | kind 10002 route evidence refresh       |
| `src/lib/relays/orchestration/surface-routing.ts` | per-surface relay widening              |
| `src/lib/relays/orchestration/route-plan.ts`      | public planner entrypoints              |

## Home notes live

1. `routedAuthorRelays` with purpose `write` for followed authors.
2. Apply `relaysForSurfaceDemand` when surface rules require widening.
3. Build filters in `demand-build.ts` with session `startedAt` anchor.

## Paging

- `routeGroupsForPaging` produces author relay groups for initial/older/newer.
- Selected-author fallback chunks follow home-runtime rules (no fallback during
  normal paging except route-discovery bootstrap).

## Route refresh

- Route discovery runs as orchestrator-owned page reads (`purpose: route-discovery`).
- Live leases reopen only when the canonical route plan fingerprint changes.
- Unchanged plan after discovery must not duplicate live REQ traffic.

## Related

- [../relay-routing.md](../relay-routing.md)
- [routing-by-surface.md](routing-by-surface.md)
- [home-integration.md](home-integration.md)
