# Source Map

## Purpose

Map documentation topics to implementation files. Each module stays at or below
200 lines.

## Modules

| Module                    | Role                                         |
| ------------------------- | -------------------------------------------- |
| `demand-types.ts`         | Demand phase, surface, visibility types      |
| `intent-types.ts`         | LiveIntent and PageIntent unions             |
| `route-plan.ts`           | relay routing and discovery wrappers         |
| `demand-build.ts`         | intent plus route plan to Demand             |
| `lease-fingerprint.ts`    | canonical filter normalization               |
| `lease-key.ts`            | wire-equivalent fingerprint and wire request |
| `compatible.ts`           | demand compatibility helpers                 |
| `demand-registry.ts`      | owner refcount per fingerprint               |
| `orchestrator-live.ts`    | live lease attach, detach, suspend           |
| `orchestrator.ts`         | orchestrator factory and shared singleton    |
| `orchestrator-types.ts`   | SubscriptionOrchestrator type                |
| `orchestrator-adapter.ts` | test manager adapter                         |
| `page-reads.ts`           | readPageByIntent and semantic keys           |
| `live-demand-handles.ts`  | replaceable channel release handles          |
| `runtime-demand.ts`       | internal demand builders                     |
| `surface-routing.ts`      | per-surface relay widening                   |
| `ingress-classify.ts`     | live event classification                    |
| `metrics.ts`              | orchestration counters and gauges            |
| `../request-budget/*`     | budget derivation and NIP-11 limit helpers   |

## Tests

| Path                                           | Role               |
| ---------------------------------------------- | ------------------ |
| `tests/unit/relays/orchestration/`             | unit gates         |
| `tests/e2e/subscription-lease-sharing.spec.ts` | live lease sharing |
| `tests/e2e/subscription-three-home.spec.ts`    | three-tab dedupe   |
| `tests/e2e/subscription-pane-churn.spec.ts`    | cleanup gauges     |

## Related

- [README.md](README.md)
