# Live Lease

## Purpose

A live lease is one refcounted wire subscription shared by all compatible live
intents.

Status: Rust owns the pure owner registry, visibility counts, and detach
decisions. TypeScript still owns `REQ`/`CLOSE` side effects.

## Lifecycle

1. First visible owner registers intent; orchestrator opens wire REQ.
2. Additional compatible owners attach listeners without new REQ.
3. All owners hidden: suspend wire (CLOSE) but retain lease record.
4. Any owner visible again: resume wire without duplicate REQ if plan unchanged.
5. Last owner released: CLOSE and remove lease.

## Modules

- `crates/lkjstr-relays/src/demand/registry.rs`: owner refcount per fingerprint
- `demand-registry.ts`: current product registry
- `orchestrator-live.ts`: current product attach, detach, suspend, resume

## Related

- [owner-visibility.md](owner-visibility.md)
- [lease-key.md](lease-key.md)
- [metrics.md](metrics.md)
