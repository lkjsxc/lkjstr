# Feed Scroll Surface

## Purpose

`FeedScrollSurface` is the shared scroll shell for feed-like tabs. It owns one
vertical scroller per tab, wires near-end paging, reserves row height, and keeps
list chrome inside the scroll flow.

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
- Profile leading rows, loading/error text, load-newer affordance, empty state,
  and note rows belong to the same scroll owner.
- Virtualized lists use Virtua `VList` until Rust UI parity lands.
- Row estimates and measured deltas feed the geometry contracts in
  [height-reservation.md](height-reservation.md) and
  [geometry-model.md](geometry-model.md).
- Oversized semantic events may render as multiple real visual rows per
  [long-content.md](long-content.md), but they still use this one scroll owner.

## Geometry Rules

- Every rendered visual row has a stable key used by the virtualizer and
  geometry model.
- The row wrapper applies a reserved height before enrichment.
- `ResizeObserver` records measured heights for materialized rows.
- Height deltas above the viewport apply compensating scroll changes through
  existing anchor infrastructure.
- No second vertical scroll-owner may be introduced for geometry handling.

## Scroll Root Classes

| Surface | Scroll root class | Virtualized |
| ------- | ----------------- | ----------- |
| Home, Global, Thread, Search, Profile | `.event-list__viewport` inside `.event-list__scroller` | yes |
| Notifications | `.notification-list-scroll` | yes |
| Custom Request, Author Context | tab-specific, see surface matrix | yes |

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
- Fake placeholder event content for far rows.

## Related

- [feed-row-chrome.md](feed-row-chrome.md): row separators and embedded rows.
- [surface-matrix.md](surface-matrix.md): per-tab integration.
- [footer-phase.md](footer-phase.md): footer reducer.
- [lod-tree.md](lod-tree.md): real-data level-of-detail tree.
