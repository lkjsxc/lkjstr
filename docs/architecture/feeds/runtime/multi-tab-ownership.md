# Multi-Tab Ownership

## Purpose

Multiple Home tabs may share repository cache and compatible live Leases, but
each tab owns its page cursors and Demand owner identity.

## Shared intentionally

- IndexedDB / repository event cache for same account
- Live Lease fingerprint when filters and relays match (orchestration compatibility)

## Not shared

- `olderScanCursor`, `newestCursor` for page loads
- Bootstrap/page Demand owner tokens per runtime instance
- In-flight older page AbortController

## Hidden tabs

- Release live Demands (`visibility: hidden`)
- Retain cached window and cursors until tab close

## Status

| Rule                     | Status                  |
| ------------------------ | ----------------------- |
| Per-runtime demand owner | implemented             |
| Shared live lease        | implemented (by design) |
| Isolated page cursors    | implemented             |

## Tests

- `tests/unit/relays/orchestration/orchestrator-refcount.test.ts`
- `tests/unit/relays/orchestration/live-demand-handles.test.ts`
- `tests/unit/timeline/timeline-runtime-close.test.ts`
