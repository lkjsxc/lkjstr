# Pressure States

## Purpose

Pressure states explain the result of retention enforcement after comparing
browser usage, site budget, ledger estimates, and inventory status.

## States

| State | Meaning |
| --- | --- |
| `below-budget` | browser usage or ledger fallback is under target |
| `compacted-under-budget` | compaction brought usage under target |
| `no-prunable-candidates` | pressure remains and no safe candidate is available |
| `protected-only` | pressure remains because remaining known data is protected |
| `unknown-unowned-usage` | pressure remains in legacy, unknown, unowned, or residual storage |
| `inventory-incomplete` | inventory timed out or could not account for usage |
| `quota-pressure` | browser quota pressure remains after app compaction |
| `compaction-error` | deletion or re-read failed during enforcement |
| `quota-unavailable` | browser quota estimate is unavailable |
| `storage-api-unavailable` | browser storage APIs are unsupported |

## Rule

If usage remains above target after all eligible rows are gone, the pressure
state must say why. Silent success is not allowed when protected, unknown, or
incomplete storage remains.

## Stop Reasons

Compaction records one final stop reason:

- `below-budget`
- `no-prunable-candidates`
- `protected-only`
- `unknown-unowned-usage`
- `inventory-incomplete`
- `storage-api-unavailable`
- `quota-pressure`
- `compaction-error`
