# Demand Compatibility

## Purpose

Compatibility rules define when multiple Demands share one Lease.

## Merge Rule

Two Demands merge into one Lease when all of the following match:

1. Canonical relay multiset.
2. Canonical normalized filters.
3. `phase`.
4. `purpose`.

Otherwise the planner opens a separate Lease.

## Examples

| Demand A                                    | Demand B                               | Merge?                               |
| ------------------------------------------- | -------------------------------------- | ------------------------------------ |
| Home live, same follows filter, same relays | Home live, same account, different tab | Yes                                  |
| Home bootstrap                              | Home live                              | No -- different phase                |
| Home feed                                   | Home metadata kind `0`                 | No -- different filters/purpose      |
| Global live                                 | Home live                              | Only if filters and relays identical |
| Profile posts live                          | Profile metadata                       | No                                   |
| Thread root `ids` lookup                    | Thread reply `#e` live                 | No                                   |

## Owner Attachment

- When compatible, the second Demand attaches to the existing Lease and
  increments owner refcount.
- Events fan out to every attached runtime selector for that fingerprint.
- `release(owner)` only removes that owner; `CLOSE` fires when no owners remain.

## Visibility Interaction

- If all owners are `hidden`, live Leases release even though Demand records
  may remain for fast reattach.
- Bootstrap Leases ignore visibility for completion -- they always terminate on
  `EOSE` or cap.

## Escalation

When targeted routes miss:

1. Planner records a miss reason in diagnostics.
2. A new Demand may widen relays per [routing-by-surface.md](routing-by-surface.md).
3. Widened Demands have different relay multisets and therefore different
   fingerprints -- they do not merge with the narrow Lease.

## Non-Goals

- Merging Demands with different `limit` on bootstrap is forbidden; normalize
  limits per surface contract before creating the Demand.
- Merging across different active accounts on Home is forbidden.
