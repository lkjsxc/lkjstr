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
  - Issue `loadOlder` only after the user has scrolled down on the feed's
    scroll owner (wheel, touch, or keyboard navigation).
  - The near-end sentinel may continue to compute readiness, but `loadOlder`
    must remain blocked until a scroll-intent flag is set.
  - This prevents viewport-fill auto-backfill on initial settle.
  - Surfaces that can prune newer rows should treat only scroll-handler bottom
    triggers as older-preserving history intent.

- `explicit`
  - Issue `loadOlder` only via explicit user actions (footer button, keyboard
    shortcut, or a programmatic paging call used by tests).
  - Near-end sentinel firing must not trigger older paging.

## Recommended defaults

- Home and Global: `auto-near-end`
- Profile, Notifications, and Thread: `after-user-scroll`
- Search and tools may keep their current surface-specific behavior.

## Implementation note

User-scroll intent is tracked via the actual scroll owner (the element with
`data-scroll-owner`) using wheel/touch/keyboard handlers. Do not use the first
IntersectionObserver callback alone as the gating signal.
