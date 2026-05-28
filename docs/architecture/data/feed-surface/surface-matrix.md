# Feed Surface Matrix

## Purpose

Per-tab list integration and paging mode.

| Surface | List | Paging | Near-end | Footer phase |
| ------- | ---- | ------ | -------- | ------------ |
| Home | Virtual `EventTreeList` | Cursor window | IO + scroll | Yes |
| Global | Virtual | Cursor window | IO + scroll | Yes |
| Profile notes | Virtual | Cursor window | Fill, then scroll | Yes |
| Thread | Virtual | Cursor + newer | Fill, then scroll | Yes |
| Search | Virtual | Cursor window | IO + scroll | Yes |
| Notifications | Virtua via `FeedScrollSurface` | Older-only | Fill, then scroll | Yes |
| Custom Request | Virtual | Single read | IO + scroll | On run |
| Author Context | Virtual | Cursor window | IO + scroll | Yes |

Notifications does not use `EventTreeList` because rows are notification
records, not flattened event trees. Both paths share `FeedScrollSurface` for
scroll ownership, near-end, and footer placement. See
[feed-scroll-surface.md](feed-scroll-surface.md).

Home, Global, and Search retain automatic near-end older paging and may prefetch
as soon as loaded rows with cursors are already inside the near-end threshold.
Profile, Notifications, and Thread share short-feed viewport fill while the list
is underfilled, then require downward user scroll intent before older paging can
run.

## Shared Modules

- `src/lib/components/feed/FeedScrollSurface.svelte`
- `src/lib/feed-surface/speculative-older.ts`
- `src/lib/feed-surface/paging-state.ts`
- `src/lib/components/events/FeedSurfaceStatus.svelte`
