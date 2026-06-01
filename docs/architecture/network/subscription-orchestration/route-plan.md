# Route Plan

## Purpose

The orchestrator owns relay route planning. Runtimes supply selected relays and
author sets; the planner resolves NIP-65 routes, receipts, discovery, and
per-surface widening.

Status: Rust owns a pure route-plan reducer for selected fallback, targeted
author groups, disabled-relay exclusion, and score ordering. TypeScript still
wires discovery evidence and product reads.

## Modules

| Code                                              | Role                                    |
| ------------------------------------------------- | --------------------------------------- |
| `src/lib/relays/relay-routing.ts`                 | NIP-65 groups, paging groups, discovery |
| `src/lib/relays/relay-discovery.ts`               | kind 10002 route evidence refresh       |
| `src/lib/relays/orchestration/surface-routing.ts` | per-surface relay widening              |
| `src/lib/relays/orchestration/route-plan.ts`      | public planner entrypoints              |
| `crates/lkjstr-relays/src/route_plan/`            | Rust pure route-group planning          |

## Home notes live

1. `routedAuthorRelays` with purpose `write` for followed authors.
2. Apply `relaysForSurfaceDemand` when surface rules require widening.
3. Build filters in `demand-build.ts` with session `startedAt` anchor.

## Paging

- `routeGroupsForPaging` produces author relay groups for initial/older/newer.
- Selected read relays remain the base and fallback for paging. Author route
  groups may narrow or widen targeted attempts, but they must not remove the
  selected-relay correctness fallback unless the URL is disabled or removed.

## Route refresh

- Route discovery runs as orchestrator-owned page reads (`purpose: route-discovery`).
- Live leases reopen only when the canonical route plan fingerprint changes.
- Unchanged plan after discovery must not duplicate live REQ traffic.

## Related

- [../relay-routing.md](../relay-routing.md)
- [routing-by-surface.md](routing-by-surface.md)
- [home-integration.md](home-integration.md)
