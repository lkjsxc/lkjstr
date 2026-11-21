# Absolute-time window

## Purpose

Describe selection, provenance and scoped relay coverage for time-anchored reads.

## Contract

Protocol 15 accepts `window {anchor:{at},before,after}` for Home and Their Home
without mixed notifications. `at` is Unix milliseconds. The engine orders
projected notes by the reading time shown by the timeline, with descending
note id as the tie-breaker. When a matching repost is present, the engine uses
the newest matching repost time for both placement and row projection. Each
side caps at 800 notes, with up to `before` strictly newer than `at` and up to
`after` at or before `at`.
The existing mute and repost projection still apply. An ordinary top, key or
month window replaces the pivot. Repeating the same `{at}` with new row counts
keeps the pivot, the selected reading key and its in-progress relay pages.

The `timeWindow` message follows the rows or patch and repeats the requested
`at`. Its optional `key` seats the first matching row at or before `at`. When there
is no older row, a cache-only or settled newer edge can seat on its nearest
retained row. The key is omitted while the newer-only seat is unresolved
or the window is empty. The engine applies the same pivot as cache or
follow membership changes. Their Home includes `followList.state` as
`unknown` or `latest-verified`; the latter includes the list timestamp and id. Unsupported sources
report `unsupported` on both sides and keep their prior window. Page
subscriptions receive this message through the optional `timeWindow` handler.

## Older relay span

For a visible Their Home with a verified public kind-3 list and a nonzero
older row count, a finite note/repost request starts at the pivot second
inclusive. A narrower query `until` and the query `since` still apply. The
usual reader-route policy selects relays. Each selected route can advance its
own inclusive `until` when the requested rows extend below its current
boundary, up to eight pages per route and at most 200 events per page. A full page consisting of a
single boundary second stops at `partial`. The cache deduplicates the overlap
by event id and retains descending note id order for ties.

`older` reports `loading` while coverage is in flight, `stalled` when any
selected route fails or its completed frontier cannot be verified, and
`partial` when a completed full page still leaves coverage unresolved.
`end` requires verified short EOSE pages on every selected route. It
describes those requests. Loss of their verification frontier leaves the
edge unresolved. With no eligible
relay request the edge is `cache-only`. Home remains cache-only on both sides.

The older request owns its envelope and coverage for the visible subscription,
exact millisecond pivot and verified kind-3 id. Pivots still share relay
connections. Hiding, closing, changing the pivot or replacing the list
releases its requests. Late replies for released envelopes cannot settle the
new span. The signed kind-3 watch and keyed hydration remain active while
visible. The store keeps the latest verified list it holds, which may be newer
than the selected moment. Historical follows need their own evidence.

## Newer relay span

A visible Their Home with a verified list and a nonzero newer row count
reads from the second after the pivot through the wall-clock second pinned
when that pivot was set. Signed event times are whole seconds. A row stamped
at the pivot second is at or before the pivot, including at an exact second.
The query's own bounds can narrow either end. An empty interval sends no
request. Growing the window at the same pivot keeps the upper bound.

Relays return newest-first pages. Each full page narrows its own route's
inclusive upper bound to the oldest event in the page, even if the cache
already fills the newer rows. The overlap preserves ties and verified event
ids deduplicate them. A full page that cannot move past its upper second
leaves that second unresolved and looks below it when there is room.
Each route reads at most eight pages of up to 200 events. Reaching the cap
or leaving a saturated second unresolved yields `partial`. A route without
a verified frontier yields `stalled`. Only a verified short page after the
preceding pages have resolved can establish `end` for that route.

Rows can enter the window as verified events arrive. Until coverage settles,
the rows describe the nearest eligible notes retained so far. If the window
contains newer rows only, seating waits for the newer edge to settle. The newer
edge describes coverage of the selected relay requests through the pinned
upper bound.
The two edges own separate requests, cursors and evidence. Each edge takes
the least resolved state among its selected routes and releases its
requests on the same lifecycle boundaries as the older span.
