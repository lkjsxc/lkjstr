# Paging Cursors Invariant

## Purpose

Define how descending feeds request older and newer pages without gaps,
duplicates, or inverted UI order.

## Display cursors

- `oldestCursor`: `{ createdAt, id }` of oldest **visible** row
- `newestCursor`: `{ createdAt, id }` of newest **visible** row
- Compound cursor tie-breaks on `id` when `created_at` matches (second resolution)

## Scan cursors

- Relay backward scans may use `until` overlap at the oldest visible timestamp
- Dedupe by event `id` after merge; overlap is safer than `created_at - 1`
- Scan cursors are per-runtime; display cursors may differ during in-flight pages

## Older page

1. Request with `until` at or before oldest visible boundary (overlap allowed)
2. Merge incoming events into map-by-id state
3. Re-sort newest-first; older rows appear below newer rows

## Newer page

1. Request with `since` at or after newest visible boundary
2. Merge; never prepend without re-sort

## Status

| Rule                                       | Status                  |
| ------------------------------------------ | ----------------------- |
| Overlap + id dedupe for same-second events | implemented             |
| Older merge cannot float above newer       | implemented via reducer |
| Per-runtime scan cursors                   | implemented             |

## Tests

- `tests/unit/timeline/timeline-reducer.test.ts`
- `tests/e2e/timeline-regression.spec.ts`
