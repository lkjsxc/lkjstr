# Feed Surface Near-End

## Purpose

Near-end detection starts older-page work before the user reaches the list
bottom.

## Threshold

- Base constant `nearEndPixels = 1200`.
- Effective threshold: `max(nearEndPixels, viewportHeight * 2)`.
- `nearEndRootMargin(viewportHeight)` returns `${effectiveThreshold}px` for
  observer `rootMargin`.

## IntersectionObserver Sentinel

- Each feed scroller mounts a bottom sentinel observed with the scroller as
  `root`.
- `rootMargin` uses the effective threshold so the callback fires while the
  sentinel is still below the visible viewport.
- The sentinel disconnects when the list destroys or when `hasOlder` is false.
- The observer owner is a factory with idempotent `observe` and `disconnect`
  methods so replaced scroll roots, disabled paging, and destroyed components
  release the previous `IntersectionObserver` before another one can run.
- Near-end callbacks are deduped while an observer-triggered callback is in
  flight and while `loadingOlder` is true.

## Scroll Fallback

- Virtual lists and native notification lists also call `isNearEnd` from scroll
  handlers using the same effective threshold.
- Scroll fallback runs when `IntersectionObserver` is unavailable or the
  sentinel is not mounted.

## Timeline Older Requests

- When near end and `hasOlder` is true, `TimelineTab` may request one
  additional older page after the first completes.
- Home and Global may issue an earlier safe prefetch once rows and cursors
  exist and the current scroll geometry is already inside the near-end
  threshold.
- Prefetch aborts on tab close and resets when the runtime key changes.
- Coordinators pass the trigger source to callers that need to distinguish a
  scroll-bottom request from a sentinel callback.
- Older paging may be gated by `olderLoadMode` (for example, blocking
  `loadOlder` until the user has scrolled down). See
  [older-load-mode.md](older-load-mode.md).

## Implementation

- `src/lib/components/events/EventTreeListNearEnd.svelte`
- `src/lib/components/events/event-tree-list-near-end-sentinel.ts`
- `src/lib/tabs/timeline/timeline-tab-older-requests.ts`
- `src/lib/events/feed-window.ts`: `isNearEnd`, `nearEndThreshold`
- `src/lib/feed-surface/near-end.ts`: re-exports and `nearEndRootMargin`
