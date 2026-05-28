# Feeds Architecture

## Purpose

Canonical architecture for Home, Global, Profile, Thread, and Notifications feed
semantics: ordering, paging, filters, merge, cursors, and multi-tab ownership.

## Table of Contents

### Invariants

- [invariants/README.md](invariants/README.md)
- [invariants/event-ordering.md](invariants/event-ordering.md)
- [invariants/paging-cursors.md](invariants/paging-cursors.md)
- [invariants/filter-safety.md](invariants/filter-safety.md)

### Sources

- [sources/README.md](sources/README.md)
- [sources/home.md](sources/home.md)
- [sources/global.md](sources/global.md)
- [sources/profile.md](sources/profile.md)
- [sources/notifications.md](sources/notifications.md)

### Runtime

- [runtime/README.md](runtime/README.md)
- [runtime/merge-reducer.md](runtime/merge-reducer.md)
- [runtime/per-runtime-cursors.md](runtime/per-runtime-cursors.md)
- [runtime/relay-incomplete-windows.md](runtime/relay-incomplete-windows.md)
- [runtime/multi-tab-ownership.md](runtime/multi-tab-ownership.md)

### Bridge

- [orchestration-bridge.md](orchestration-bridge.md)

## Related

- [../data/feed-surface/README.md](../data/feed-surface/README.md): scroll, footer, near-end
- [../network/subscription-orchestration/README.md](../network/subscription-orchestration/README.md)
- [../../product/feeds/README.md](../../product/feeds/README.md): product contracts
- [../../operations/timeline-notification-regression-investigation.md](../../operations/timeline-notification-regression-investigation.md)

## Implementation map

| Concern               | Module                                          |
| --------------------- | ----------------------------------------------- |
| Event ordering        | `src/lib/events/event-order.ts`                 |
| Timeline filters      | `src/lib/query/timeline-filters.ts`             |
| Notification filters  | `src/lib/notifications/notification-filters.ts` |
| Timeline merge        | `src/lib/timeline/timeline-reducer.ts`          |
| Notification merge    | `src/lib/notifications/notification-reducer.ts` |
| Home runtime          | `src/lib/timeline/timeline-runtime.ts`          |
| Notifications runtime | `src/lib/notifications/notification-runtime.ts` |
