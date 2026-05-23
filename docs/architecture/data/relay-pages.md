# Relay Pages

## Purpose

Relay page helpers turn one-shot relay reads into deterministic feed pages while
preserving where each real event was seen.

## Contract

- `readRelayPage()` is the raw relay primitive. It returns relay receipts from
  the subscription manager and keeps exact relay provenance available to callers.
- Feed surfaces use `readRelayFeedPage()` for event rows.
- Feed pages sort by descending `{created_at,id}` with lower ids first inside
  the same second.
- Duplicate events from multiple relays merge into one feed row with the union
  of relay URLs.
- Page slicing happens after collection, cursor filtering, sorting, and relay
  provenance merging.
- `before` cursor filtering is local. For the same second as the boundary it
  keeps events with ids greater than the cursor id.
- `after` cursor filtering is local. For the same second as the boundary it
  keeps events with ids less than the cursor id.
- Relay `until` and `since` boundaries may over-fetch the boundary second.
  Local cursor filtering decides the final page membership.
- `boundaryUntil(cursor)` returns `createdAt + 1` so older relay pages can
  fetch every same-second candidate.
- `boundarySince(cursor)` returns `createdAt - 1` when the cursor is not at
  unix time zero so newer relay pages can fetch every same-second candidate.
- Raw reads remain valid for exact id lookup, latest replaceable selection, and
  other cases where caller-specific ordering is required.

## Callers

- Home, Global, Profile, Search, Custom Request, Author Context, and Thread
  reply pages use sorted provenance-preserving feed pages.
- Reference resolution and other id-batch lookups may use raw relay pages when
  output order is driven by the requested ids.
- Metadata and follow-list reads remain separate from visible post pages.
