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
  Global, Profile posts, Notifications, and safe Custom Request event-list reads
  use adaptive grouped scans.
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
- Home, Global, Profile posts, Notifications, and safe Custom Request initial,
  older, and newer relay reads use an adaptive segment queue that starts with a
  `1` minute segment.
- Each segment produces one window feedback value:
  - `limit-hit`: at least one contacted relay-shaped request reached its
    effective limit. This is dense evidence, not successful complete coverage.
  - `under-half`: every contacted relay-shaped request returned at most
    `floor(effectiveLimit / 2)`, completed normally, and none hit the limit.
    This is successful sparse coverage.
  - `balanced`: contacted complete relay-shaped request that is neither
    `limit-hit` nor `under-half`. This is successful coverage.
  - `incomplete`: relay status did not prove EOSE completion.
- `limit-hit` windows split the current segment and scan the half closest to the
  visible edge first. Older scans process the newer half first; newer scans
  process the older half first. Unsplittable `limit-hit` windows become
  unresolved terminal frontiers.
- For complete contacted windows, `under-half` advances to the next adjacent
  segment with doubled span, and `balanced` advances with unchanged span.
- For incomplete windows, incomplete status never proves history exhaustion.
  Timeout, close, auth, socket close, socket error, and missing detailed status
  remain non-exhaustive. Incomplete large root windows may split
  conservatively, but they must not drive sparse doubling.
- Bounds: minimum span is `1` second, initial span is `1` minute, maximum
  grown span is `180` days, a page processes at most `96` segments, and split
  depth is capped at `32`.
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

## Cache Eligibility

A segment is cache-eligible only when all required relay, filter, and route
group rows for that semantic feed key and segment are recorded as complete.
Dense, unresolved, incomplete, failed, missing, expired, or compacted evidence
cannot prove cache eligibility.

Cache-first rendering applies the same display bounds as relay rendering:
future events and rows outside local `since`, exclusive `until`, `before`, or
`after` stay hidden. A cached result may satisfy the visible tab only when the
local event repository returns rows inside the requested bounds and coverage
evidence proves that absent rows are genuinely absent.

## Surface Keys

- Home keys include active account pubkey, selected read relays, page size, feed
  policy, and route fingerprint.
- Global keys include selected read relays, page size, and display kinds.
- Profile keys include target pubkey, selected relays, page size, and profile
  route fingerprint.
- Notifications keys include active account pubkey, selected or notification
  relay set, notification kinds, page size, and `#p` target.
- Custom Request keys include normalized relays, normalized filters, page size,
  and whether the request uses adaptive or exact mode.

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

- Home, Global, Profile posts, Notifications, and safe Custom Request event-list
  pages use adaptive bounded scans for initial, older, and newer catch-up pages.
- Search, exact id requests, Custom Request filters with `ids` or `search`,
  Author Context, Thread reply pages, metadata lookup, follow-list reads, thread
  root lookup, and id-batch reference resolution keep exact request semantics
  unless they already intentionally use grouped feed scans.
- Reference resolution may use raw relay pages when output order is driven by
  the requested ids.
