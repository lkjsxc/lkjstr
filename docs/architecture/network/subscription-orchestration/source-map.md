# Orchestration Source Map

## Purpose

Maps documentation contracts to `src/lib/relays/orchestration/` modules. Each
file stays at or below `200` lines.

## Modules

| Module | Contract |
|--------|----------|
| `demand-types.ts` | Demand, Lease, Phase, OwnerId types |
| `normalize-filter.ts` | Canonical filters and fingerprint hash |
| `compatible.ts` | Merge eligibility |
| `demand-registry.ts` | Register, release, visibility pause |
| `lease-planner.ts` | Demand set → Lease map, owner refcount |
| `lease-bridge.ts` | Attach/detach subscription manager |
| `metrics.ts` | Orchestration counters |
| `ingress-classify.ts` | Render-critical vs lazy intake |
| `orchestrator.ts` | `createSubscriptionOrchestrator` factory |
| `surface-routing.ts` | Per-surface relay list builders |

## Adjacent Code

| Path | Role |
|------|------|
| `src/lib/relays/subscription-manager.ts` | Listener-shared pool reads |
| `src/lib/relays/subscription-manager-keys.ts` | Fingerprints vs wire keys |
| `src/lib/relays/relay-pool.ts` | One WebSocket per URL |
| `src/lib/relays/runtime-subscriptions.ts` | Orchestrator accessor for runtimes |

## Tests

| Path | Role |
|------|------|
| `tests/unit/relays/orchestration/` | Normalization, compatibility, refcount |
| `tests/e2e/subscription-lease-sharing.spec.ts` | Two tabs, one live lease |
| `tests/e2e/subscription-pane-churn.spec.ts` | Lease baseline after close |
