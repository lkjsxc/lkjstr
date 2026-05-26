# Tab Retention Flow

## Purpose

Tab retention flow describes how inactive tabs preserve UI state across focus
changes and page reloads without keeping mounted DOM or live relay work.

## Blur Path

When pane focus leaves tab `A` for tab `B`:

1. `pane-scroll-retention.remember(A)` captures the primary scroll owner
   `scrollTop`, including `0`.
2. `captureRuntimeSnapshot(A)` merges feed cursors, anchors, and tool fields
   from `tabRuntimeRegistry`.
3. `persistTabSnapshot` writes IndexedDB `tabStates` for workspace reload.
4. If `tabs.inactiveRetentionSeconds > 0`, `session-tab-snapshots.retain` stores
   an in-memory copy (LRU cap `32`).

Tab `A` body unmounts immediately after blur processing starts.

## Focus Path

When tab `B` becomes active:

1. Session `take(B)` when present within TTL.
2. Else `loadPersistedTabSnapshot` from IndexedDB.
3. `bodyScroll.restoreSnapshot` and `restore(B)` apply tool `scrollTop`.
4. Feed tabs restore virtua anchor + runtime snapshot via `restoreAnchor` and
   `restoreSnapshot` props on `PaneTabBody`.
5. Fresh runtime and relay subscriptions start from restored cursors; cache
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

- [tab-runtime.md](tab-runtime.md): lifecycle contract.
- [storage.md](../data/storage.md): `tabStates` schema.
- [tabs.md](../../product/workspace/tabs.md): product-visible behavior.
