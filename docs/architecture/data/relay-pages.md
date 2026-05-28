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
- Feed display bounds reject future events and locally enforce `since`,
  exclusive `until`, `before`, and `after` before rows enter page results.
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
- Home, Profile, and Global initial, older, and newer relay reads use an
  adaptive segment queue. The minimum span is `1` second, initial span is `12`
  minutes, maximum grown span is `180` days, a page processes at most `96`
  segments, and split depth is capped at `32`.
- Adaptive scans classify every contacted complete window as `limit-hit`,
  `under-half`, or `balanced`. Incomplete windows are separate and never prove
  sparse history.
- `limit-hit` means at least one relay reached its relay-effective filter cap.
  Splittable windows split immediately, with older scans processing the newer
  half first and newer scans processing the older half first. Unsplittable
  limit-hit windows become unresolved terminal frontiers.
- `under-half` means every contacted relay completed below half of its
  relay-effective cap. The next adjacent window doubles the current span up to
  `180` days.
- `balanced` means every contacted relay completed without hitting a cap, but
  at least one relay returned half or more of its relay-effective cap. The next
  adjacent window keeps the current span.
- A segment only advances relay history when every contacted relay proves EOSE
  completion below the relay-effective filter cap.
- Grouped feed scans own their relay `since` and `until` bounds at dispatch
  time. A caller filter builder may add tighter bounds, but omitting scan bounds
  must not produce an unbounded feed request.
- Newer catch-up scans also start at the newest bounded window and move
  downward toward the `after` cursor so the newest matching relay events return
  first.
- Complete limit-hit segments split instead of inflating the requested filter
  limits. Cursor-slack retries are still bounded and only apply when the read
  did not hit the relay-effective limit. Minimum-span limit-hit segments become
  unresolved.
- Relay reads use a bounded event cap computed from the sum of relay-effective
  filter limits, contacted relay count, and visible page size, then capped by
  the subscription manager safety ceiling.
- Incomplete segments split once when large, then stop conservatively if the
  next contacted segment is still incomplete. Relay timeout, closure, auth,
  socket closed, and socket error never prove history exhaustion.
- Event-limit stops are non-exhaustive. Expected dense event-limit windows
  record coverage metadata with `reason: event-limit` without appending
  `relay-feed-incomplete`; empty or non-dense event-limit stops still warn.
- Dense or unresolved boundaries constrain the next scan cursor. Older scans
  must not advance below the nearest unresolved frontier newer than the rendered
  oldest event; newer scans use the symmetric rule above the rendered newest
  event.
- Only detailed relay statuses with EOSE and no terminal failure prove a grouped
  feed scan window complete. Missing detailed status is incomplete.
- Density feedback is decided per relay and per relay-shaped request budget.
  Aggregate counts across relays do not create density by themselves.
- `limit` is always a positive safety cap. Relay-effective limit saturation
  marks more relay history possible; under-half and balanced complete windows
  may continue adjacent scans without splitting.
- Grouped scan results expose `receivedItems` for cache writes. Visible page
  semantics still use sliced `items`.

## Staged Feed Page Pipeline

Feed runtimes treat each older or initial page as three stages:

1. **Acquire**: `readRelayFeedGroups()` or `readRelayFeedPage()` returns
   events; the repository persists rows and provenance.
2. **Window merge**: event ids merge into the resident feed window; UI emits
   minimized `FeedEvent` rows from cached bodies without waiting for hydration.
3. **Enrich**: profile metadata and reference previews load for visible and
   near-visible rows only.

Stage 2 must not block on stage 3. Relay latency and enrichment latency are
independent on the critical path to first paint.

## Callers

- Home, Global, and Profile feed pages use adaptive bounded scans for initial,
  older, and newer catch-up pages. Search, Custom Request, Author Context, and
  Thread reply pages keep exact requested filter semantics with sorted
  provenance-preserving feed pages.
- Reference resolution and other id-batch lookups may use raw relay pages when
  output order is driven by the requested ids.
- Metadata and follow-list reads remain separate from visible post pages.
