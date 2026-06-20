# Feed Surface Matrix

## Purpose

Per-tab list integration, paging mode, geometry, and level-of-detail use.

| Surface | List | Paging | Geometry | Footer |
| ------- | ---- | ------ | -------- | ------ |
| Home | Virtual `EventTreeList` | Cursor window | Required | Yes |
| Global | Virtual | Cursor window | Required | Yes |
| Profile notes | Virtual | Cursor window | Required | Yes |
| Thread | Virtual | Cursor plus newer | Required | Yes |
| Search | Virtual | Cursor window | Required | Yes |
| Notifications | Virtua via `FeedScrollSurface` | Older-only | Required | Yes |
| Followees | Virtua via `FeedScrollSurface` | Scroll offset hydrate | Required | No |
| User Timeline | Virtual `EventTreeList` | Auto near-end | Required | Yes |
| Custom Request | Virtual | Single read | Required for event lists | On run |
| Author Context | Virtual | Cursor window | Required | Yes |

Notifications does not use `EventTreeList` because rows are notification
records, not flattened event trees. Both paths share `FeedScrollSurface` for
scroll ownership, near-end, footer placement, and height reservation. See
[feed-scroll-surface.md](feed-scroll-surface.md).

Home, Global, and Search retain automatic near-end older paging and may prefetch
as soon as loaded rows with cursors are already inside the near-end threshold.
Profile, Notifications, and Thread share short-feed viewport fill while the list
is underfilled, then require downward user scroll intent before older paging can
run.

## LOD Use

Feed LOD applies to any surface that can hold many rows. It indexes real row ids
and coverage states. It must not materialize all rows during heavy-feed tests
and must not render fake event content.

## Shared Modules

- `src/lib/components/feed/FeedScrollSurface.svelte`
- `src/lib/feed-surface/paging-state.ts`
- `src/lib/components/events/FeedSurfaceStatus.svelte`
