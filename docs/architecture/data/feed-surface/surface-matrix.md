# Feed Surface Matrix

## Purpose

Per-tab list integration and paging mode.

| Surface | List | Paging | Near-end | Footer phase |
| ------- | ---- | ------ | -------- | ------------ |
| Home | Virtual `EventTreeList` | Cursor window | IO + scroll | Yes |
| Global | Virtual | Cursor window | IO + scroll | Yes |
| Profile notes | Virtual | Cursor window | IO + scroll | Yes |
| Thread | Virtual | Cursor + newer | IO + scroll | Yes |
| Search | Virtual | Cursor window | IO + scroll | Yes |
| Notifications | Native `.notification-list` | Older-only | IO + scroll | Yes |
| Custom Request | Virtual | Single read | IO + scroll | On run |
| Author Context | Virtual | Cursor window | IO + scroll | Yes |

Notifications does not use `EventTreeList` because rows are notification
records, not flattened event trees.

## Shared Modules

- `src/lib/feed-surface/speculative-older.ts`
- `src/lib/feed-surface/paging-state.ts`
- `src/lib/components/events/FeedSurfaceStatus.svelte`
