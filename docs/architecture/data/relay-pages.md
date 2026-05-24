# Relay Pages

## Purpose

Relay page helpers turn one-shot relay reads into deterministic feed pages while
preserving where each real event was seen.

## Contract

- `readRelayPage()` is the raw relay primitive. It returns relay receipts from
  the subscription manager and keeps exact relay provenance available to callers.
- `readRelayFeedGroups()` returns feed items, completeness flags, a safe scan
  cursor, density state, and conservative `hasMorePossible`.
- Exact-request feed surfaces use `readRelayFeedPage()` for event rows. Home,
  Profile, and Global initial or historical feeds use adaptive grouped scans.
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
- Home, Profile, and Global initial or historical relay reads use an adaptive
  segment queue. The minimum span is `1` second, initial span is `6` hours,
  maximum grown span is `180` days, a page processes at most `96` segments, and
  split depth is capped at `32`.
- Complete sparse or empty segments may grow the next span. A segment only
  advances relay history when every contacted relay proves EOSE completion
  below the relay-effective filter cap.
- Grouped feed scans own their relay `since` and `until` bounds at dispatch
  time. A caller filter builder may add tighter bounds, but omitting scan bounds
  must not produce an unbounded feed request.
- Newer catch-up scans also start at the newest bounded window and move
  downward toward the `after` cursor so the newest matching relay events return
  first.
- Dense segments retry with higher limits up to `4x`, then split. Older scans
  split the newer half first. Dense minimum-span segments become unresolved.
- Incomplete segments split once when large, then stop conservatively if the
  next contacted segment is still incomplete. Relay timeout, closure, auth,
  socket closed, and socket error never prove history exhaustion.
- Dense or unresolved boundaries constrain the next scan cursor. Older scans
  must not advance below the nearest unresolved frontier newer than the rendered
  oldest event; newer scans use the symmetric rule above the rendered newest
  event.
- Only detailed relay statuses with EOSE and no terminal failure prove a grouped
  feed scan window complete. Missing detailed status is incomplete.
- Density is decided per relay and per relay-shaped request budget. Aggregate
  counts across relays do not make a segment dense by themselves.
- `limit` is always a positive safety cap. A relay-effective limit or
  per-relay budget saturation marks more relay history possible.
- Grouped scan results expose `receivedItems` for cache writes. Visible page
  semantics still use sliced `items`.

## Callers

- Home, Global, and Profile feed pages use adaptive bounded scans for initial,
  older, and newer catch-up pages. Search, Custom Request, Author Context, and
  Thread reply pages keep exact requested filter semantics with sorted
  provenance-preserving feed pages.
- Reference resolution and other id-batch lookups may use raw relay pages when
  output order is driven by the requested ids.
- Metadata and follow-list reads remain separate from visible post pages.
