# Feed Runtime

## Purpose

How runtimes hold state, merge pages, track cursors, and coordinate with
orchestration.

## Table of Contents

- [feed-window-reducer.md](feed-window-reducer.md)
- [feed-runtime-core.md](feed-runtime-core.md)
- [feed-surface-inputs.md](feed-surface-inputs.md)
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
| Rust core     | `crates/lkjstr-app/src/feed/`                   |

## Progressive Reads

Runtimes render cached rows first, accept generation-guarded partial relay
snapshots, and only show empty states after terminal relay coverage.

## Policy Preflight

Rust feed builders run pure policy reducers before creating cache or relay
commands. Protected surfaces use typed account availability and may create relay
queries only for a real selected account. Public read-only target surfaces use a
route-availability reducer that accepts durable selected relays, allowed session
default public relays, or real author routes. Empty states such as
`no-user-timeline-relay` and `no-enabled-relay` come from those policy results,
not from ad hoc host storage failures.
