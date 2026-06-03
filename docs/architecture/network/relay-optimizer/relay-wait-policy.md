# Relay Wait Policy

## Purpose

The relay wait policy decides when a feed surface paints cached rows, partial
relay rows, incomplete states, late inserts, and terminal empty or unavailable
states.

## First Paint

- At read start, render complete cache rows immediately when coverage proves
  them.
- Render partial cache rows when present and mark uncovered relay work as
  checking.
- Start uncovered relay reads without blocking first paint.
- Before the first relay event, show compact non-blocking checking text, not a
  terminal empty state.
- Paint as soon as any valid relay rows arrive.
- If no rows arrive quickly, paint after a short bounded wait with available
  partial rows and pending status.

## Foreground Merge

- Keep merging relay rows into the visible page during the initial foreground
  merge window.
- After that window, keep relevant slow relay work bounded in the background.
- Late rows merge only when they fall inside the current visible window or a
  near-visible buffer.
- Exact Thread and Profile context reads may use a slightly longer context wait
  before showing unavailable context.
- If unavailable context later arrives as a real event, replace the unavailable
  row with the real row.

## Empty And Timeout States

- Empty is terminal-only. Show empty only when complete coverage proves absence
  or every contacted required relay has terminal non-renderable evidence.
- While relays are pending, the aggregate state is checking, partial, or
  incomplete, never empty.
- Timeout with visible rows is an incomplete state.
- Timeout without rows is retryable unavailable or timeout state, not silent
  absence.

## Late Inserts

- Deduplicate by event id and merge relay provenance.
- Sort by canonical newest-first ordering.
- If the user is near the top, insert newer rows immediately.
- If the user has scrolled away, preserve the scroll anchor and stage a newer
  items affordance.
- Older page loads preserve the pre-load anchor after late merges.
- Cancelled generations ignore late relay evidence.

## Diagnostics

Diagnostics may show compact status, relay URLs, counts, timings, coverage
state, and generation cancellation. They must not show raw relay payloads, full
filters, tab ids, or request ids.
