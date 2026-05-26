# Event Surface Paging

## Purpose

Event surface paging defines shared bottom loading, near-end prefetch, and
status rows across feed tabs. Canonical behavior lives in
[feed-surface.md](feed-surface.md).

## Surfaces

| Surface | List mode | Paging |
| ------- | --------- | ------ |
| Home, Global | Virtual `FeedSurfaceList` | Cursor window |
| Thread, Search, Custom Request, Author Context | Virtual | Cursor window |
| Profile Notes | Virtual | Cursor window |
| Notifications | Virtual | Older-only window |

## Near-End Threshold

- Base constant `nearEndPixels = 1200`.
- Effective threshold: `max(nearEndPixels, viewportHeight * 1.5)`.
- `isNearEnd` and `isNearStart` use the effective threshold for scroll handlers.
- List sentinels use `IntersectionObserver` with matching `rootMargin`.

## Bottom Status

- Shared component `FeedSurfaceStatus` renders:
  - loading older rows
  - end of known history
  - error text when the runtime exposes a terminal error
- Virtual lists inject status rows through list data.

## Speculative Prefetch

- When near end and `hasOlder` is true, runtimes may request one additional
  older page before the user reaches the list bottom.
- Prefetch is deduped per tab runtime and aborted on tab close.

## Tab Restoration

- Feed tabs capture anchor event id and offset on blur.
- Session snapshots restore within `tabs.inactiveRetentionSeconds`.
- IndexedDB `tabStates` restores anchors across reload when present.
