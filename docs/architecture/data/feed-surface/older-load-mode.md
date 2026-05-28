# Older Load Mode

## Purpose

Near-end detection can fire on initial mount when content is shorter than the
viewport. `olderLoadMode` defines which user intent signals are required
before issuing `loadOlder` for a feed.

## Modes

- `auto-near-end`
  - Issue `loadOlder` whenever the near-end sentinel fires and `hasOlder` is
    true (plus any shared speculative prefetch rules).
  - This mode may trigger without explicit user scroll when the list is short.

- `after-user-scroll`
  - Issue `loadOlder` only from a `scroll` trigger produced while consuming a
    current downward user gesture on the feed's scroll owner (wheel, touch, or
    keyboard navigation).
  - The near-end sentinel may continue to compute readiness, but `loadOlder`
    must remain blocked for observer-only `near-end` triggers.
  - This prevents viewport-fill auto-backfill on initial settle.
  - Prior scrolling does not unlock observer or `viewport-fill` triggers.
  - Surfaces that can prune newer rows should treat only scroll-handler bottom
    triggers as older-preserving history intent.

- `fill-then-user-scroll`
  - Issue `loadOlder` from bounded `viewport-fill` triggers only while the
    scroll area is underfilled.
  - Once content is scrollable, block observer-only `near-end` triggers and
    allow only real downward `scroll` triggers from the scroll owner.
  - This mode gives short feeds enough history to become scrollable without
    starting an unbounded background scan.

- `explicit`
  - Issue `loadOlder` only via explicit user actions (footer button, keyboard
    shortcut, or a programmatic paging call used by tests).
  - Near-end sentinel firing must not trigger older paging.

## Recommended defaults

- Home and Global: `auto-near-end`
- Profile, Notifications, and Thread: `fill-then-user-scroll`
- Search and tools may keep their current surface-specific behavior.

## Implementation note

User-scroll intent is tracked via the actual scroll owner (the element with
`data-scroll-owner`) using wheel/touch/keyboard handlers. The intent is
short-lived and consumed by the next downward scroll event on that owner. Do not
use a prior scroll, a viewport-fill measurement, or the first
IntersectionObserver callback as the gating signal after the list is scrollable.
