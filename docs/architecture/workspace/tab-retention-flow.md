# Tab Retention Flow

## Purpose

Tab retention flow describes how inactive tabs preserve UI state across focus
changes and page reloads. Mounted DOM holds scroll and form state; snapshots
backstop reload and missing-mount cases without live relay work on hidden tabs.

## Blur Path

When pane focus leaves tab `A` for tab `B`:

1. `tab-snapshot-coordinator.rememberScroll(A)` captures the primary scroll owner
   `scrollTop`, including `0`.
2. `captureRuntimeSnapshot(A)` merges feed cursors, anchors, and tool fields
   from `tabRuntimeRegistry`.
3. The coordinator writes IndexedDB `tabStates` with key
   `workspaceId + tabId`; `paneId` is stored only as `lastPaneId`.
4. If `tabs.inactiveRetentionSeconds > 0`, the coordinator stores an in-memory
   copy (LRU cap `32`).

Tab `A` body stays mounted but hidden. Feed runtimes pause.

## Focus Path

When tab `B` becomes active:

1. Show tab `B` body (visibility and pointer events).
2. When `B` stayed mounted, use live DOM scroll and fields first.
3. Else the workspace coordinator consumes the warm snapshot when present.
4. Else it loads IndexedDB by `workspaceId + tabId`.
5. The coordinator emits `TabSnapshotRestore { token, payload }`.
6. Each mounted tab body receives that token once; after render, the parent calls
   `consumeRestore` and stale tokens are ignored.
7. Feed tabs restore virtua anchor + runtime snapshot via `restoreAnchor` and
   `restoreSnapshot` when mount state was missing.
8. Active runtime and relay subscriptions resume from restored cursors; cache
   repopulates the window before network where the feed contract requires it.

## Per Tab Kind Fields

| Kind family    | Session + IDB fields                                    |
| -------------- | ------------------------------------------------------- |
| Feed tabs      | row anchor, `scrollTop`, cursors, flags, bounded ids    |
| Notifications  | feed fields plus notification ids and scan cursor       |
| Search         | query filter state plus feed fields                     |
| Settings/tools | `scrollTop`, cheap `fields` map                         |
| Tweet          | durable draft flush; no worker or diagnostics retention |

Feed tabs register `registerTabRuntimeSnapshot` on mount so blur capture is
complete even when the list scrolled after the last explicit scroll event.
Event-feed tabs expose one icon-only restore control. It is enabled when the
current tab has a saved row anchor and restores the latest anchor without
changing row layout or scrollbar width.

## Scroll Owner

Each tab body marks its primary scroller with `data-scroll-owner` on the
element that owns vertical overflow. `pane-scroll-retention` reads that node
first instead of scanning all descendants.

Virtua feed lists use the Virtua viewport element inside `.event-list__scroller`.
Profile uses that same owner for summary rows and note rows; retention must not
capture a nested Notes scroller.

## Reload

IndexedDB snapshots survive session TTL expiry and full page reload. Layout and
tab metadata restore from the `workspaces` store independently. Stale pane-keyed
rows from older schemas are ignored and removed during workspace cleanup.

## Related

- [tab-body-mount.md](tab-body-mount.md): mount and visibility contract.
- [tab-snapshot-fields.md](tab-snapshot-fields.md): field and cleanup contract.
- [tab-runtime.md](tab-runtime.md): lifecycle contract.
- [storage.md](../data/storage.md): `tabStates` schema.
- [tabs.md](../../product/workspace/tabs.md): product-visible behavior.
