# Feed Runtime Cutover

## Purpose

This contract defines the shared Rust feed runtime that Home, Global, Profile,
Thread, Notifications, Search result lists, Author Context, and User Timeline
must use before their TypeScript feed runtimes are deleted.

## Current Evidence

- Rust feed reducers: `crates/lkjstr-app/src/feed/**`, `feed_wait/**`,
  `feed_geometry/**`, `feed_fragments/**`, `feed_lod/**`, and `feed_scan/**`.
- Rust relay snapshots: `crates/lkjstr-relays/src/page_read/**`.
- Rust storage rows: `crates/lkjstr-storage/src/events.rs` and
  `crates/lkjstr-storage/src/feed_cache.rs`.
- Rust row view model: `crates/lkjstr-app/src/feed/view_model/**` with focused
  tests for stable ids, duplicate relay merge, explicit unavailable and
  diagnostic rows, profile and notification rows, and footer states.
- First Home rendering slice: `crates/lkjstr-app/src/home_feed/**` and
  `crates/lkjstr-ui/src/workspace/home.rs` render `HomeFeedView` rows, with
  browser proof through injected and host-provider real event rows. The host
  provider promotes cache-complete only from exact route, relay, filter, feed,
  and interval proof, then starts a bounded selected-relay read after partial
  proof and publishes real relay event snapshots into the same view model. Home
  tab cleanup releases the provider lease and cancels the owner relay read.
  Broader shared lease cleanup and feed-surface host wiring remain open.
- First Global rendering slice: `crates/lkjstr-app/src/global_feed/**` and
  `crates/lkjstr-ui/src/workspace/global.rs` render `GlobalFeedView` rows. The
  default Rust shell now uses `crates/lkjstr-web/src/global_feed_*.rs` to load
  selected-relay SQLite rows, require exact Global coverage before cache-ready,
  keep partial proof explicit, and start a bounded selected-relay read after
  partial proof. Browser proof confirms tab cleanup suppresses late completions.
  Global scroll and TypeScript deletion prerequisites remain open.
- First Notifications rendering slice: `crates/lkjstr-app/src/notifications_feed/**`
  and `crates/lkjstr-ui/src/workspace/notifications.rs` render
  `NotificationsFeedView` rows. The default Rust shell loads active-account
  SQLite notification records and cached source events through
  `crates/lkjstr-web/src/notifications_feed_*.rs`, promotes cache-ready only
  from exact account `#p` coverage, and starts a bounded selected-relay read
  after partial proof. Browser proof confirms tab cleanup suppresses late
  completions and the Leptos tab uses one scroll owner for status, rows, and
  footer. Pure Rust tests cover initial/older notification cursors, history
  exhaustion, and fill-then-scroll intent gating. Rust/WASM proof covers
  bounded older relay filters, event rejection, and empty older-window footer
  behavior. The shared footer row now carries `feed.loadOlder`, and the Rust
  Notifications host retains relay output state so the explicit footer command
  and a downward near-end scroll gesture start the next bounded older relay read
  through the shared planner. Deletion proof remains open.
- First Profile rendering slice: `crates/lkjstr-app/src/profile_feed/**` and
  `crates/lkjstr-ui/src/workspace/profile.rs` render `ProfileFeedView` rows from
  the shared row view model. Browser proof opens My Profile and renders injected
  real authored note content with explicit missing-pubkey, missing-relay, and
  partial states covered by app tests. The default Rust host provider reads
  SQLite authored display-kind rows from selected-relay fallback or target
  author routes, promotes cache-ready only from exact Profile coverage proof,
  starts bounded relay reads after partial proof, excludes metadata and
  follow-list rows from visible note slots, and releases owner cleanup on tab
  switch. Recent complete-empty coverage now plans older sparse intervals, and
  terminal empty requires contiguous exact empty coverage down to the floor.
- Followees action tab slice: `crates/lkjstr-app/src/follow_graph/**`,
  `crates/lkjstr-ui/src/workspace/followees*.rs`, and
  `crates/lkjstr-web/tests/profile_feed_tab_test.rs` render a first Leptos
  Followees body from real NIP-02 entries injected through a provider. The
  default browser provider also reads cached kind `3` rows from worker SQLite
  and starts bounded selected-relay or stored author-route kind `3` discovery on
  cache miss. Disabled stored route relays are excluded. Browser cleanup proof
  closes the selected-relay read and suppresses late events. The typed request
  now exposes the same `is_released()` guard shape as other feed providers.
  No-event selected reads complete to retryable diagnostics. Deletion proof
  remains open.
- User Timeline action tab slice: `crates/lkjstr-app/src/user_timeline/**`,
  `crates/lkjstr-ui/src/workspace/user_timeline*.rs`, and
  `crates/lkjstr-web/tests/profile_feed_tab_test.rs` render first Leptos feed
  rows from an injected real NIP-02 author set. The default browser provider
  also reads cached kind `3` author sets and cached display rows from worker
  SQLite, keeps them partial without complete coverage, and promotes cache-ready
  only from exact User Timeline coverage proof. It starts a bounded
  selected-relay kind `3` read on cache miss, reads stored
  NIP-65/provenance/target author routes when present, excludes disabled stored
  route relays, rebuilds from stored relay events, turns
  no-event/AUTH/rate-limited/timeout reads and partial route failures into
  explicit diagnostics, and closes the selected-relay read on tab switch. The
  typed request now exposes the same `is_released()` guard shape as other feed
  providers.
  Deletion proof remains open.
- Author Context first slice: `crates/lkjstr-app/src/author_context_feed/**`,
  `crates/lkjstr-ui/src/workspace/author_context*.rs`, and
  `crates/lkjstr-web/src/author_context_*.rs` render injected rows and
  worker-cached anchor/nearby author rows plus bounded selected-relay rows
  through shared `FeedViewModel` rows. Exact anchor lookup uses selected or
  stored author-route relays when the anchor is uncached. Missing event id,
  author pubkey, relay/route input, and anchor timestamp are explicit
  unavailable states. Converted Rust feed surfaces share event body, common
  state-row rendering, and footer shell rendering. Row action buttons open Rust
  Profile, Thread, and Author Context tabs. Fast UI provider proof covers
  request-level release guards and late-completion suppression. Deletion proof
  remains open.
- Cached and relay-refreshed Profile header metadata/follow-count proof exists.
  The known following-count action opens converted Followees, the Profile header
  action opens converted User Timeline, own-profile actions open Profile Edit, the copy
  menu uses host-backed npub/nprofile/follow-list/relay-set JSON, and
  follow/unfollow publish proof exists. Deletion proof remains open.
- Thread bootstrap provider slice: `crates/lkjstr-app/src/thread_feed/**`,
  `crates/lkjstr-ui/src/workspace/thread.rs`, and
  `crates/lkjstr-web/src/thread_feed_*.rs` render `ThreadFeedView` rows from
  cached worker-owned SQLite events and bounded relay snapshots. The host
  derives the NIP-10 root from the focused event when available, loads the root
  by id, loads display-kind replies by `#e` root or focused-event tags, follows
  bounded cached parent-chain ids, starts selected-relay bootstrap reads for
  focused/root/visible-parent ids and recent root/focused tagged replies, merges
  progressive snapshots, starts a bounded live reply window from the newest
  retained row, exposes the shared older footer command, and starts a bounded
  older `#e` page read from retained relay state when the footer command fires.
  Downward near-end scroll and underfilled viewport probes forward the same
  older path. Terminal parent misses after exact cache and complete relay lookup
  render retryable unavailable-parent rows, and capped deep branches render
  continuation rows that open matching Thread tabs. Deletion proof and broader
  Thread parity remain open.
- Shared feed runtime lifecycle:
  `crates/lkjstr-app/tests/feed_runtime_lifecycle_test.rs` proves release
  removes live demand, closes the live wire, preserves the bounded window, and
  applies to Home, Global, Profile, and Notifications.
- Current shipped feed runtime: `src/lib/timeline/**`, `src/lib/profile/**`,
  `src/lib/thread/**`, `src/lib/notifications/**`, and `src/lib/feed-surface/**`.
- Rust pure reducers exist. Product wiring, SQLite proof, Leptos feed rendering,
  relay paging, and TypeScript deletion remain partial.

## Runtime State

The shared runtime state contains:

- semantic feed id and surface kind.
- owner id, active account, subject pubkey or event id, and selected relay mode.
- route plan and route group fingerprints.
- cache proof for each required relay, route group, filter shape, and interval.
- page-read demand and live subscription preference.
- progressive relay snapshots and partial failure diagnostics.
- event map, stable row ids, ordering cursors, `hasOlder`, and `hasNewer`.
- footer state, unavailable state, and retry commands.
- scroll anchor hints, width bucket, row geometry estimate, and reservation key.
- hydration priority queue with owner-scoped cancellation.

## Feed Row View Model

The first pure row view-model owner is
`crates/lkjstr-app/src/feed/view_model/**`. It consumes feed-window events,
explicit unavailable or diagnostic records, and footer inputs, then returns
typed rows for UI layers. UI components consume these rows; they do not parse
raw Nostr events.

Rows use stable ids and real data only:

```text
event:<event-id>
profile:<pubkey>
notification:<event-id>:<kind>
unavailable:<reason>:<subject>
diagnostic:<scope>:<id>
footer:<feed-id>
```

A row view model includes renderer kind, event id or unavailable reason,
author identity state, timestamp, content fragments, media descriptors, custom
emoji, content warning state, repost or reference target state, action state,
height reservation, and diagnostics. Components must not parse Nostr events.

## Cache Proof

Cache-hit display is valid only when storage coverage proves all required
semantic keys, route groups, relay URLs, normalized filters, and bounded time
intervals. Missing, stale, compacted, dense, incomplete, auth-required, failed,
or disabled-relay evidence cannot prove absence. Missing cache rows trigger
relay planning or an explicit unavailable state, not an empty feed.

## Progressive Snapshot Consumption

The runtime merges snapshots by event id as relays answer. Fast relay rows can
render before slow relays finish. Slow or failed routes update diagnostics and
footer state without blocking reachable relays. A terminal empty state appears
only when every required route group has complete proof for the requested span.

## Route Group Completeness

Each read records route group key, relays attempted, relays excluded, relays
that reached EOSE, failed relays, auth-required relays, timeout state, cursor,
span, and cache proof expiry. EOSE from one route group never proves absence for
another group. Global is complete only for selected enabled read relays.

## Footer States

The footer is data, not a component inference. Required states are loading,
cache-hit, reading-relays, partial, auth-required, retryable failure,
configuration unavailable, terminal empty, terminal with rows, and older-load
ready. Footer rows must carry the command, disabled reason, or diagnostic id;
`OlderLoadReady` uses the shared `feed.loadOlder` command.

## Scroll And Geometry Ownership

`lkjstr-app` owns pure anchor capture, anchor reconciliation, row geometry
estimates, visual fragments, height reservation, dematerialization, and LOD tree
state. `lkjstr-web` may report DOM measurements and load persisted model rows.
Durable row-height persistence is partial: typed `feed_row_height_*` repositories
exist and Home/Global/Notifications/Profile/Thread/Search/Author Context/User
Timeline consume matching models for cached rows. Converted event snapshots and
Profile header relay rebuilds preserve cache-loaded models; browser scroll
proof and runtime geometry counters remain open.

## Unavailable-State Derivation

Unavailable state is explicit data. It records the subject, missing proof,
attempted relays, excluded relays, storage failures, route failures, signer or
account absence when relevant, and retry availability. Reference previews must
be backed by real events or compact unavailable rows.

## Must Not Clauses

- No fake data.
- No placeholder success.
- No direct browser database access from product code.
- No unbounded arrays.
- No hidden global state.
- No deletion before parity proof.
- No status claim without source/test evidence.
