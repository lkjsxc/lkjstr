# Live Lease

## Purpose

A live lease is one refcounted wire subscription shared by all compatible live
intents.

Status: Rust owns the pure owner registry, visibility counts, attach/detach
reducer, and host-effect decisions. TypeScript still owns shipped `REQ`/`CLOSE`
side effects.

## Lifecycle

1. First visible owner registers intent; orchestrator opens wire REQ.
2. Additional compatible owners attach listeners without new REQ.
3. All owners hidden: suspend wire (CLOSE) but retain lease record with no
   active release handle.
4. Releasing the last visible owner while hidden owners remain also suspends
   the wire.
5. Any owner visible again: resume wire without duplicate REQ if plan unchanged.
6. Last owner released: CLOSE when needed and remove lease.

## Modules

- `crates/lkjstr-relays/src/demand/registry.rs`: owner refcount per fingerprint
- `crates/lkjstr-relays/src/live_lease/`: pure host-effect reducer
- `demand-registry.ts`: current product registry
- `orchestrator-live.ts`: current product attach, detach, suspend, resume

## Related

- [owner-visibility.md](owner-visibility.md)
- [lease-key.md](lease-key.md)
- [metrics.md](metrics.md)
