# Absolute-time cache window

## Purpose

Describe the cached selection and provenance for time-anchored reads.

## Contract

Protocol 15 accepts `window {anchor:{at},before,after}` for Home and Their Home
without mixed notifications. `at` is Unix milliseconds. The engine orders
projected notes by the reading time shown by the timeline, with descending
note id as the tie-breaker. When a matching repost is present, the engine uses
the newest matching repost time for both placement and row projection. Each
side caps at 800 notes, with up to `before` strictly newer than `at` and up to
`after` at or before `at`.
The existing mute and repost projection still apply. An ordinary top, key or
month window replaces the pivot. Reopening or closing releases it.

The `timeWindow` message follows the rows or patch and repeats the requested
`at`. Its optional `key` seats the first matching row at or before `at`, or
the nearest newer cached row when no older one is present in the window.
An empty window omits the key. The engine applies the same pivot as cache or
follow membership changes. Their Home includes `followList.state` as
`unknown` or `latest-verified`; the latter includes the list timestamp and id. Each
side reports `cache-only`. Unsupported sources report `unsupported` on both
sides and keep their prior window. Page subscriptions receive this message
through the optional `timeWindow` handler.

The pivot does not request note history by time. The visible Their Home
subscription still watches the selected author's public kind-3 contact list.
Keyed hydration for the selected rows also still runs. This is the latest
verified contact list the engine holds and may be newer than the selected
moment. The store retains only one kind-3 event per author. Relay coverage
on each side and historical follow evidence require separate contracts.
