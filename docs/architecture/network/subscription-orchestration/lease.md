# Lease

## Purpose

A Lease is what the relay layer actually keeps open after Demand
canonicalization and merge. One Lease maps to one multiplexed subscription per
relay connection set.

## Shape

| Field | Meaning |
|-------|---------|
| `fingerprint` | Stable hash of relays, normalized filters, phase, and purpose |
| `relays` | Normalized relay URL multiset |
| `wireSubId` | Opaque relay-safe id (max `48` characters on the wire) |
| `phase` | `bootstrap`, `live`, or `page` |
| `purpose` | Same vocabulary as Demand |
| `owners` | Set of Demand owner ids currently attached |
| `strategy` | `backward` for bootstrap and page; `forward` for live |

## Refcount

- Each attached Demand owner increments the Lease owner count.
- When the owner count reaches zero, the planner issues `CLOSE` on every active
  relay for that wire id before deleting the Lease record.
- Listener refcount inside the subscription manager remains an implementation
  detail below the planner; the planner owns owner refcount semantics.

## CLOSE Guarantees

- Zero owners ⇒ `CLOSE` within the same synchronous turn when possible.
- Tab close, runtime `close()`, orchestrator shutdown, and relay disable all
  release owners and close orphaned Leases.
- Bootstrap Leases always close on `EOSE`, event cap, timeout, terminal relay
  state, or abort — even if owners remain (bootstrap is not long-lived).
- Live Leases stay open while owners exist and the Lease is visible-backed.

## Wire ID Rules

- Long logical keys never reach the wire; compaction uses opaque ids.
- Paged reads lease wire ids through the existing read-id lease table until
  `finally` release.
- Live Leases reuse one wire id per fingerprint until the Lease closes.

## Relation to Paged Read Leases

The existing **read sub-id lease** in `relay-read-leases` avoids collisions for
one-shot backward reads. That mechanism stays below the planner. Orchestration
**Leases** are the higher-level shared subscription registry described here.
