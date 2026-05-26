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
- Near-end callbacks are deduped while `loadingOlder` is true.

## Scroll Fallback

- Virtual lists and native notification lists also call `isNearEnd` from scroll
  handlers using the same effective threshold.
- Scroll fallback runs when `IntersectionObserver` is unavailable or the
  sentinel is not mounted.

## Speculative Older

- When near end and `hasOlder` is true, `createOlderRequestCoordinator` may
  request one additional older page after the first completes.
- Prefetch aborts on tab close and resets when the runtime key changes.

## Implementation

- `src/lib/feed-surface/near-end-observer.ts`
- `src/lib/events/feed-window.ts` — `isNearEnd`, `nearEndThreshold`
- `src/lib/feed-surface/near-end.ts` — re-exports and `nearEndRootMargin`
