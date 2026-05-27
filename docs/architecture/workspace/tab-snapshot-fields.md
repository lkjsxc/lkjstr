# Tab Snapshot Fields

## Purpose

This contract defines compact tab-owned snapshot payloads. Identity is always
`workspaceId + tabId`; pane id is placement metadata only.

## Coordinator

`createTabSnapshotCoordinator` is owned by the route/workspace root. It tracks
scroll owners, runtime snapshot providers, field providers, pre-capture hooks,
warm LRU snapshots, one-shot restore tokens, durable saves, lifecycle flushes,
and cleanup.

## Restore Order

1. Live mounted DOM state wins.
2. Warm in-memory snapshot, capped at `32` and governed by
   `tabs.inactiveRetentionSeconds`.
3. IndexedDB `tabStates` row keyed as `${workspaceId}:${tabId}`.
4. Runtime recreate with cache-first reads before relay reads where supported.

Restore delivery uses `TabSnapshotRestore { token, payload }`. A tab consumes a
token once after render; repeated or stale tokens are ignored and counted.

## Payload Rules

Feed payloads may store:

- `scrollTop`, `anchorEventId`, and `anchorOffset`.
- `oldestCursor`, `newestCursor`, `hasOlder`, and `hasNewer`.
- `filterState` when the surface has cheap primitive filters.
- `eventIds`, capped at `200`.
- `notificationRecordIds`, capped at `200`, for Notifications only.

Tool payloads may store:

- `scrollTop`.
- Primitive `fields` for recoverable UI inputs and cheap statuses.
- Durable draft flush markers when the durable store owns the actual draft.

Payloads must not store full events, profile maps, relay diagnostics, active
workers, subscription handles, timers, raw relay responses, or unbounded arrays.
Missing ids during hydration are ignored; normal cache-first or relay reads
continue.

## Cleanup

Explicit tab close deletes durable and warm snapshots for that tab. Workspace
cleanup deletes durable rows only for tabs absent from the workspace and for
stale pane-keyed rows from older schemas. Moving a tab, including edge split
movement, preserves the same `tabId` and therefore preserves the durable row.

## Tests

Required coverage includes durable keying, save/load after pane movement,
delete-by-tab-id, stale-row cleanup, warm LRU ownership, falsy-value merge,
one-shot restore consume, stale-token rejection, and cleanup only for absent
tabs. Runtime and Playwright coverage must include focus retention, cross-pane
move, edge-split move, reload restore, active-tab reload, tool restore, close
cleanup, warm LRU cap, and no hidden feed paging.
