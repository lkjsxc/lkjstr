# Relay Optimizer Failure States

## Purpose

This file defines optimizer failure and unavailable states so product code can
continue safely without inventing evidence.

## State Table

| State | Meaning | Product behavior |
| --- | --- | --- |
| `available` | Rust/WASM bridge, storage, and product inputs are usable | Plan spans, reduce observations, persist rows, and show real Stats rows |
| `unavailable` | Required host capability or bridge export is missing | Continue correctness fallback and show unavailable diagnostics |
| `timeout` | A bridge, storage, or read provider exceeded its deadline | Continue correctness fallback and record timeout diagnostics only |
| `memory-fallback` | SQLite worker is running in temporary memory mode | Use rows for the session only and show temporary memory state |
| `storage-unavailable` | Storage worker or schema cannot be used | Do not persist optimizer rows; show storage unavailable state |
| `invalid-input` | DTOs, model keys, or scan context fail validation | Reject the optimizer step and continue without learned evidence |

## Relay Read Failures

- Relay close, timeout, AUTH, socket error, malformed response, and request-size
  rejection are diagnostic evidence for that read only.
- A failed relay never blocks reachable relays from rendering real events.
- Failed reads can lower advisory scores but cannot prove event absence.
- Disabled or removed relays are excluded before any failure-state processing.

## Storage Failures

- Temporary memory mode is explicit and visible in Stats.
- Storage unavailable means no optimizer observation, model, or trace row is
  written for that step.
- Repair may report orphan optimizer rows, but optimizer repair must not delete
  protected product records.

## Bridge Failures

- Missing bridge exports and import failures map to `unavailable`.
- Host deadline expiry maps to `timeout`.
- DTO validation failure maps to `invalid-input`.
- Bridge failures may write a redacted app-log row when logging is available.
- Bridge failures must not insert neutral density models or fake traces.

## Stats Rule

Stats rows are real or explicit states from this file. If the optimizer has no
provider for a row, render unavailable instead of a zero, demo, or neutral row.
