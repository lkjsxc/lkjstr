# Routing by Surface

## Purpose

Per-surface routing tables tell the planner which relays to put on a Demand
before any widening step.

## Home

| Step      | Relays                                                                  |
| --------- | ----------------------------------------------------------------------- |
| Primary   | Selected read relays (enabled, normalized)                              |
| Expansion | Bounded author routes from NIP-65, NIP-02, receipts, discovery evidence |
| Fallback  | Selected read group always appended as mandatory base coverage          |

Bootstrap/live note Demands use `purpose: feed`. Follow discovery and metadata
use separate Demands with `purpose: metadata` or `route-discovery`.

## Global

| Step      | Relays                            |
| --------- | --------------------------------- |
| Primary   | Selected read relays only         |
| Expansion | None -- no author route expansion |

## Profile

| Step      | Relays                                                                |
| --------- | --------------------------------------------------------------------- |
| Primary   | Target author NIP-65 **write** relays when present                    |
| Secondary | Selected read relays                                                  |
| Metadata  | Selected + author routes + discovery relays for kinds `0` and `10002` |
| Posts     | Selected + author routes; discovery excluded unless selected          |

## Notifications

| Step     | Relays                                |
| -------- | ------------------------------------- |
| Primary  | Active account NIP-65 **read** relays |
| Fallback | Selected read relays                  |

## Thread

| Step     | Relays                                                  |
| -------- | ------------------------------------------------------- |
| Primary  | `nevent` / `e` / `q` tag hints and event relay receipts |
| Widening | Selected read relays only after documented miss         |

Root `ids` fetch and reply `#e` live tail may be separate Demands when filters
differ.

## Search and Custom Request

| Step    | Relays                                                 |
| ------- | ------------------------------------------------------ |
| Primary | User-selected relays for the tool                      |
| NIP-50  | Capability-gated; separate Demand per search execution |

## Escalation

Widening creates a new Demand with a new fingerprint. Log the miss reason once
per surface key per session.

## Bounds

All numeric caps remain as defined in [relay-routing.md](../relay-routing.md):
max `4` route relays per author, max `12` targeted groups, max `50` authors per
group, and selected fallback rules.
