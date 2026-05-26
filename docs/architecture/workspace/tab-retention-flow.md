# Tab Retention Flow

## Purpose

Tab retention flow describes how inactive tabs preserve UI state across focus
changes and page reloads. Mounted DOM holds scroll and form state; snapshots
backstop reload and missing-mount cases without live relay work on hidden tabs.

## Blur Path

When pane focus leaves tab `A` for tab `B`:

1. `pane-scroll-retention.remember(A)` captures the primary scroll owner
   `scrollTop`, including `0`.
2. `captureRuntimeSnapshot(A)` merges feed cursors, anchors, and tool fields
   from `tabRuntimeRegistry`.
3. `persistTabSnapshot` writes IndexedDB `tabStates` for workspace reload.
4. If `tabs.inactiveRetentionSeconds > 0`, `session-tab-snapshots.retain` stores
   an in-memory copy (LRU cap `32`).

Tab `A` body stays mounted but hidden. Feed runtimes pause.

## Focus Path

When tab `B` becomes active:

1. Show tab `B` body (visibility and pointer events).
2. When `B` stayed mounted, use live DOM scroll and fields first.
3. Else session `take(B)` when present within TTL.
4. Else `loadPersistedTabSnapshot` from IndexedDB.
5. `bodyScroll.restoreSnapshot` and `restore(B)` apply tool `scrollTop` when
   mount state was missing.
6. Feed tabs restore virtua anchor + runtime snapshot via `restoreAnchor` and
   `restoreSnapshot` when mount state was missing.
7. Active runtime and relay subscriptions resume from restored cursors; cache
   repopulates the window before network where the feed contract requires it.

## Per Tab Kind Fields

| Kind family    | Session + IDB fields                                           |
| -------------- | -------------------------------------------------------------- |
| Feed tabs      | anchor id/offset, `scrollTop`, cursors, `hasOlder`, `hasNewer` |
| Search         | query + feed fields via runtime registry                       |
| Settings/tools | `scrollTop`, `fields` map                                      |
| Tweet          | draft hash in `fields`                                         |

Feed tabs register `registerTabRuntimeSnapshot` on mount so blur capture is
complete even when the list scrolled after the last explicit scroll event.

## Scroll Owner

Each tab body marks its primary scroller with `data-scroll-owner` on the
element that owns vertical overflow. `pane-scroll-retention` reads that node
first instead of scanning all descendants.

Virtua feed lists use the Virtua viewport element inside `.event-list__scroller`.

## Reload

IndexedDB snapshots survive session TTL expiry and full page reload. Layout and
tab metadata restore from the `workspaces` store independently.

## Related

- [tab-body-mount.md](tab-body-mount.md): mount and visibility contract.
- [tab-runtime.md](tab-runtime.md): lifecycle contract.
- [storage.md](../data/storage.md): `tabStates` schema.
- [tabs.md](../../product/workspace/tabs.md): product-visible behavior.
