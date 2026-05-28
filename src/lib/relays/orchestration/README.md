# Subscription Orchestration

Browser-local planner between feed runtimes and the relay pool.

## Table of Contents

- [Modules](#modules)
- [Public API](#public-api)
- [Related](#related)

## Modules

- [demand-types.ts](demand-types.ts): Demand phase, surface, visibility
- [intent-types.ts](intent-types.ts): LiveIntent and PageIntent
- [route-plan.ts](route-plan.ts): relay routing and discovery
- [demand-build.ts](demand-build.ts): intent to Demand
- [lease-fingerprint.ts](lease-fingerprint.ts): canonical filters
- [lease-key.ts](lease-key.ts): wire-equivalent fingerprint and wire request
- [compatible.ts](compatible.ts): demand compatibility
- [demand-registry.ts](demand-registry.ts): owner refcount
- [orchestrator-live.ts](orchestrator-live.ts): live lease lifecycle
- [orchestrator.ts](orchestrator.ts): factory and shared singleton
- [orchestrator-types.ts](orchestrator-types.ts): SubscriptionOrchestrator
- [orchestrator-adapter.ts](orchestrator-adapter.ts): test manager adapter
- [page-reads.ts](page-reads.ts): readPageByIntent
- [runtime-demand.ts](runtime-demand.ts): demand builders
- [surface-routing.ts](surface-routing.ts): per-surface relay widening
- [ingress-classify.ts](ingress-classify.ts): live event classification
- [metrics.ts](metrics.ts): counters and gauges

## Public API

- `submitLiveIntent(intent)` for live tails
- `readPageByIntent(intent, options)` for bootstrap and page reads
- `subscribeDemand` / `readDemandPage` remain for internal migration

## Related

- [../../../../docs/architecture/network/subscription-orchestration/README.md](../../../../docs/architecture/network/subscription-orchestration/README.md)
