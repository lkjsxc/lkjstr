# Pressure States

## Purpose

Pressure states explain the result of retention enforcement after comparing
browser usage, site budget, ledger estimates, and inventory status.

## States

| State | Meaning |
| --- | --- |
| `below-budget` | browser usage or ledger fallback is under target |
| `compacted-under-budget` | compaction brought usage under target |
| `candidate-limited` | eligible rows were deleted but pressure remains |
| `protected-only` | only durable or dynamic protected rows remain |
| `unknown-only` | pressure remains without known prunable bytes |
| `inventory-incomplete` | inventory timed out or could not account for usage |
| `quota-unavailable` | browser quota estimate is unavailable |
| `storage-api-unavailable` | browser storage APIs are unsupported |

## Rule

If usage remains above target after all eligible rows are gone, the pressure
state must say why. Silent success is not allowed when protected, unknown, or
incomplete storage remains.
