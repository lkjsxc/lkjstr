# Feed Runtime

## Purpose

How runtimes hold state, merge pages, track cursors, and coordinate with
orchestration.

## Documents

- [merge-reducer.md](merge-reducer.md)
- [per-runtime-cursors.md](per-runtime-cursors.md)
- [relay-incomplete-windows.md](relay-incomplete-windows.md)
- [multi-tab-ownership.md](multi-tab-ownership.md)

## Modules

| Surface | Runtime |
|---------|---------|
| Home | `src/lib/timeline/timeline-runtime.ts` |
| Global | `src/lib/timeline/global-timeline-runtime.ts` |
| Notifications | `src/lib/notifications/notification-runtime.ts` |
