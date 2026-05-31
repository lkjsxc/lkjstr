# Tab Snapshots

## Purpose

Tab snapshots preserve workspace continuity without retaining full events,
profiles, relay diagnostics, workers, or subscriptions.

## Store

`tabStates` rows use `${workspaceId}:${tabId}` as the durable key. `lastPaneId`
is placement metadata only and is not identity.

Payloads may include scroll anchors, cursors, flags, cheap tool fields, and up
to `200` event or notification ids. They must not include full events,
profiles, relay diagnostics, active workers, subscriptions, or unbounded arrays.

## Retention

Active workspace snapshots are protected user data. Workspace cleanup deletes
absent snapshots and their ledger rows immediately. If stale absent snapshots
remain, cache compaction may delete them through the `tab-state` dispatcher.

## Repair

Ledger repair backfills missing tab-state rows from `tabStates` and removes
orphan `tab-state` ledger rows only when the target row is definitely missing.
