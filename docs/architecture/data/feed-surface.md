# Feed Surface

## Purpose

Feed surface is the shared contract for feed-like tabs: near-end detection,
bottom status, speculative older prefetch, staged row materialization, and
virtual list integration.

## Surfaces

| Surface | List | Paging |
| ------- | ---- | ------ |
| Home, Global | Virtual `FeedSurfaceList` | Cursor window |
| Thread, Search, Custom Request, Author Context | Virtual | Cursor window |
| Profile Notes | Virtual | Cursor window |
| Notifications | Virtual | Older-only window |

See [event-surface-paging.md](event-surface-paging.md) for threshold constants.

## Near-End Threshold

- Base constant `nearEndPixels = 1200`.
- Effective threshold: `max(nearEndPixels, viewportHeight * 1.5)`.
- `IntersectionObserver` sentinels use `rootMargin` equal to the effective
  threshold so older-page work starts before the user reaches the list bottom.
- `isNearEnd` and `isNearStart` use the same effective threshold for scroll
  handlers that do not use observers.

## Bottom Status

- Shared component `FeedSurfaceStatus` renders:
  - loading older rows
  - end of known history
  - error text when the runtime exposes a terminal error
- Virtual lists inject status rows through list data.
- All feed surfaces listed above render the same footer semantics.

## Speculative Prefetch

- When near end and `hasOlder` is true, runtimes may request one additional
  older page before the user reaches the list bottom.
- Prefetch is deduped per tab runtime and aborted on tab close.
- `speculativeOlderInFlight` prevents duplicate concurrent speculative reads.

## Paging Reducer

Feed runtimes expose a shared footer phase:

| Phase | Condition |
| ----- | --------- |
| `idle` | Not loading older; `hasOlder` may be true |
| `loadingOlder` | Older page in flight and `hasOlder` |
| `end` | `hasOlder === false` and at least one row |
| `error` | Terminal older-page error string set |

## Staged Row Pipeline

Older-page latency is reduced by splitting work:

1. **Relay page** — acquire events; persist through the repository.
2. **Row shell** — merge event ids into the feed window; render minimized rows
   immediately from cached event bodies.
3. **Enrichment** — hydrate profiles and reference previews for visible and
   near-visible rows asynchronously.

Stages must not block stage 2 on completion of stage 3.

## Scroll Anchoring

- Feed views capture visible key and offset before feed changes.
- Virtual lists restore through [feed-memory.md](feed-memory.md) scroll anchor
  helpers after older loads, live prepends, and tab restore.

## Tab Restoration

- Feed tabs capture anchor event id and offset on blur.
- Session snapshots restore within `tabs.inactiveRetentionSeconds`.
- IndexedDB `tabStates` restores anchors and feed cursors across reload. See
  [../workspace/tab-runtime.md](../workspace/tab-runtime.md).
