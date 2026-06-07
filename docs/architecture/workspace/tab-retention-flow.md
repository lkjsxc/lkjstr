# Tab Retention Flow

## Purpose

Tab retention flow describes how inactive tabs preserve UI state across focus
changes and page reloads. Mounted DOM holds scroll and form state; snapshots
backstop reload and missing-mount cases without live relay work on hidden tabs.

## Blur Path

When pane focus leaves tab `A` for tab `B`, blur capture happens before any
focus restore for `B`:

1. `tab-snapshot-coordinator.rememberScroll(A)` captures the explicit primary
   `[data-scroll-owner]` `scrollTop`, including `0`.
2. `captureRuntimeSnapshot(A)` merges feed cursors, anchors, and tool fields
   from `tabRuntimeRegistry`.
3. The coordinator writes a durable SQLite OPFS worker tab snapshot with key
   `workspaceId + tabId`; `paneId` is stored only as `lastPaneId`.
4. If `tabs.inactiveRetentionSeconds > 0`, the coordinator stores an in-memory
   copy (LRU cap `32`).

Tab `A` body stays mounted but hidden. Feed runtimes pause.

## Focus Path

When tab `B` becomes active:

1. Show tab `B` body (visibility and pointer events).
2. When `B` stayed mounted, use live DOM scroll and fields first. A mounted live
   scroll owner wins over warm or persisted snapshots during normal tab
   switches.
3. Else the workspace coordinator consumes the warm snapshot when present.
4. Else it loads the durable worker snapshot by `workspaceId + tabId`.
5. The coordinator emits `TabSnapshotRestore { token, payload }`.
6. Each mounted tab body receives that token once; after render, the parent calls
   `consumeRestore` and stale tokens are ignored.
7. Tool tabs that load rows asynchronously keep the restore scroll value locally
   until their scroll owner exists and content has rendered.
8. Feed tabs restore virtua anchor + runtime snapshot via `restoreAnchor` and
   `restoreSnapshot` when mount state was missing.
9. Active runtime and relay subscriptions resume from restored cursors; cache
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
Event-feed tabs automatically restore the latest saved row anchor without
changing row layout or scrollbar width.

## Scroll Owner

Each tab body marks exactly one primary scroller with `data-scroll-owner` on the
element that owns vertical overflow. `pane-scroll-retention` reads only that
node and forbids arbitrary descendant scanning. A pending persisted scroll
restore stays authoritative until it is applied, so rapid focus changes cannot
overwrite it with a fresh mount at `0`.

Scroll restore is owner-scoped: it targets only the active tab being restored,
and scroll events are ignored when the target owner does not belong to the
tracked tab body.

Virtua feed lists use the Virtua viewport element inside `.event-list__scroller`.
Profile uses that same owner for summary rows and note rows; retention must not
capture a nested Notes scroller.

## Reload

Durable worker tab snapshots survive session TTL expiry and full page reload.
Layout and tab metadata restore from the SQLite workspace store independently.
Stale pane-keyed rows from older schemas are ignored and removed during
workspace cleanup.

## Related

- [tab-body-mount.md](tab-body-mount.md): mount and visibility contract.
- [tab-snapshot-fields.md](tab-snapshot-fields.md): field and cleanup contract.
- [tab-runtime.md](tab-runtime.md): lifecycle contract.
- [tab-snapshots.md](../data/storage/data-classes/tab-snapshots.md): `tabStates` schema.
- [tabs.md](../../product/workspace/tabs.md): product-visible behavior.
