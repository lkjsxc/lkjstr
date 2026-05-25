# Event Surface Paging

## Purpose

Event surface paging defines shared bottom loading, near-end prefetch, and
status rows across feed tabs.

## Surfaces

| Surface | List mode | Paging |
| ------- | --------- | ------ |
| Home, Global | Virtual `EventTreeList` | Cursor window |
| Thread, Search, Custom Request, Author Context | Virtual | Cursor window |
| Profile Notes | Plain scroll | Cursor window |
| Notifications | Plain scroll | Older-only window |

## Near-End Threshold

- Base constant `nearEndPixels = 900`.
- Effective threshold: `max(nearEndPixels, viewportHeight * 0.75)`.
- `isNearEnd` and `isNearStart` use the effective threshold for scroll handlers.

## Bottom Status

- Shared component `FeedSurfaceStatus` renders:
  - loading older rows
  - end of known history
  - error text when the runtime exposes a terminal error
- Virtual lists inject status rows through list data.
- Plain-scroll tabs render the component after the scroll content.

## Speculative Prefetch

- When near end and `hasOlder` is true, runtimes may request one additional
  older page before the user reaches the list bottom.
- Prefetch is deduped per tab runtime and aborted on tab close.

## Tab Restoration

- Feed tabs capture anchor event id and offset on blur.
- Session snapshots restore within `tabs.inactiveRetentionSeconds`.
- IndexedDB `tabStates` restores anchors across reload when present.
