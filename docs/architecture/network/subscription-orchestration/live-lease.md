# Live Lease

## Purpose

A live lease is one refcounted wire subscription shared by all compatible live
intents.

## Lifecycle

1. First visible owner registers intent; orchestrator opens wire REQ.
2. Additional compatible owners attach listeners without new REQ.
3. All owners hidden: suspend wire (CLOSE) but retain lease record.
4. Any owner visible again: resume wire without duplicate REQ if plan unchanged.
5. Last owner released: CLOSE and remove lease.

## Modules

- `demand-registry.ts`: owner refcount per fingerprint
- `orchestrator-live.ts`: attach, detach, suspend, resume

## Related

- [owner-visibility.md](owner-visibility.md)
- [lease-key.md](lease-key.md)
- [metrics.md](metrics.md)
