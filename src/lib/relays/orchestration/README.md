# Relay orchestration modules

## Purpose

Browser-local Demand and Lease planning above the subscription manager.

## Modules

- [demand-types.ts](demand-types.ts): Demand shapes.
- [lease-fingerprint.ts](lease-fingerprint.ts): Canonical fingerprints.
- [demand-registry.ts](demand-registry.ts): Owner registry.
- [orchestrator.ts](orchestrator.ts): Shared orchestrator factory.
- [orchestrator-live.ts](orchestrator-live.ts): Live lease attach/detach.
- [orchestrator-adapter.ts](orchestrator-adapter.ts): Test adapter helpers.
- [metrics.ts](metrics.ts): Session counters.
