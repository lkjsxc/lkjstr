# Pressure States

## Purpose

Pressure states explain the result of retention enforcement after comparing
browser usage, site budget, ledger estimates, inventory status, and protected
records.

## States

| State | Meaning |
| --- | --- |
| `below-target` | browser usage or ledger fallback is under target |
| `target-met` | compaction brought usage under target |
| `no-prunable-candidates` | pressure remains and no safe candidate is available |
| `protected-only` | pressure remains because remaining known data is protected |
| `unknown-unowned-usage` | pressure remains in old, unknown, unowned, or residual storage |
| `inventory-incomplete` | inventory timed out or could not account for usage |
| `quota-pressure` | browser quota pressure remains after app compaction |
| `storage-api-unavailable` | browser storage APIs are unsupported or denied |
| `compaction-error` | deletion or re-read failed during enforcement |
| `deadline` | the bounded compaction deadline ended before a final state |

## Rule

If usage remains above target after all eligible rows are gone, the pressure
state says why. Silent success is not allowed when protected, unknown, or
incomplete storage remains.

## Stop Reasons

Compaction records one final stop reason:

- `below-target`
- `target-met`
- `no-prunable-candidates`
- `protected-only`
- `unknown-unowned-usage`
- `inventory-incomplete`
- `quota-pressure`
- `storage-api-unavailable`
- `compaction-error`
- `deadline`

Stats projects these stop reasons from real pressure snapshot rows. If the row
is missing or unreadable, pressure byte rows stay unavailable with the storage
problem reason instead of reporting `target-met` or zero-byte success.

`below-target` and `target-met` are successful terminal states and do not map to
storage problem kinds. The remaining stop reasons map to stable pressure
problem-kind labels so diagnostics, retention, and Stats describe the same
failure cause.

## Trigger Points

Pressure checks run through background tasks:

- after storage worker readiness;
- after large event-ingest batches;
- after ledger byte estimates cross budget;
- after browser origin usage crosses budget;
- after manual Compact now;
- during idle time after relay bursts.

Compaction deletes bounded batches, yields between batches, re-reads summaries,
and never deletes protected records.
