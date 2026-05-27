# Feed Scroll Surface

## Purpose

`FeedScrollSurface` is the shared scroll shell for feed-like tabs. It owns one
vertical scroller per tab, wires near-end paging, and keeps list chrome inside
the scroll flow.

## Contract

- Each feed tab root uses `.feed-tab` with `overflow: hidden`. The tab shell
  must not scroll vertically.
- Exactly one descendant carries `data-scroll-owner` and owns vertical scroll.
- The scroll root uses `scrollbar-gutter: stable`, `overflow-x: clip`, and
  scroll-layout tokens from [scroll-layout.md](../../workspace/scroll-layout.md).
- Near-end detection uses `IntersectionObserver` with scroll fallback per
  [near-end.md](near-end.md).
- `FeedSurfaceStatus` renders as a row inside the scroll flow, not in a fixed
  pane footer.
- Profile leading rows, including the profile summary, loading/error text,
  load-newer affordance, and empty state, belong to the same scroll owner as
  note rows.
- Virtualized lists use Virtua `VList` inside the scroll surface. Notifications
  use the same Virtua path with flat notification records.
- Non-virtual tool tabs keep their existing scroll roots documented in
  [tab-shell-layout.md](../../workspace/tab-shell-layout.md).

## Scroll Root Classes

| Surface | Scroll root class | Virtualized |
| ------- | ----------------- | ----------- |
| Home, Global, Thread, Search, Profile | `.event-list__viewport` inside `.event-list__scroller` | yes |
| Notifications | `.notification-list-scroll` | yes |
| Custom Request, Author Context | tab-specific (see surface matrix) | yes |

## Component Ownership

- `src/lib/components/feed/FeedScrollSurface.svelte` owns the scroll shell.
- `EventTreeList` builds leading rows, tree rows, empty rows, and footer rows,
  then passes them to `FeedScrollSurface`.
- `NotificationListScroll` maps notification records and passes them to
  `FeedScrollSurface`.
- `pane-scroll-retention.ts` reads `scrollTop` only from `[data-scroll-owner]`.

## Forbidden Patterns

- Nested `overflow: auto` between `.feed-tab` and `[data-scroll-owner]`.
- Horizontal overflow on `[data-scroll-owner]` except intentional tab-strip
  rails in pane headers.
- Footer status fixed outside the scrolling element on feed tabs.

## Related

- [feed-row-chrome.md](feed-row-chrome.md): row separators and embedded rows.
- [surface-matrix.md](surface-matrix.md): per-tab integration.
- [footer-phase.md](footer-phase.md): footer reducer.
- [near-end.md](near-end.md): sentinel thresholds.
