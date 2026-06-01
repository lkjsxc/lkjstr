# Feed Runtime

## Purpose

How runtimes hold state, merge pages, track cursors, and coordinate with
orchestration.

## Table of Contents

- [feed-window-reducer.md](feed-window-reducer.md)
- [feed-runtime-core.md](feed-runtime-core.md)
- [merge-reducer.md](merge-reducer.md)
- [per-runtime-cursors.md](per-runtime-cursors.md)
- [relay-incomplete-windows.md](relay-incomplete-windows.md)
- [multi-tab-ownership.md](multi-tab-ownership.md)
- [../../network/progressive-relay-rendering.md](../../network/progressive-relay-rendering.md)

## Modules

| Surface       | Runtime                                         |
| ------------- | ----------------------------------------------- |
| Home          | `src/lib/timeline/timeline-runtime.ts`          |
| Global        | `src/lib/timeline/global-timeline-runtime.ts`   |
| Notifications | `src/lib/notifications/notification-runtime.ts` |
| Rust core     | `crates/lkjstr-app/src/feed/`                  |

## Progressive Reads

Runtimes render cached rows first, accept generation-guarded partial relay
snapshots, and only show empty states after terminal relay coverage.
