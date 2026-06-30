# Shared feed runtime

## Purpose

Current shared feed runtime blocker details.

## Details

Build shared feed runtime from strict cache proof, relay snapshots, row view
models, anchors, footer states, and unavailable states.

- Cutover-ledger row: [Shared feed runtime](../../architecture/rust-wasm/cutover/implementation-ledger.md).
- Docs to read: [feeds README](../../architecture/feeds/README.md),
  [feed runtime](../../architecture/feeds/runtime/README.md),
  [feed surface](../../architecture/data/feed-surface/README.md),
  [cache-first pages](../../architecture/data/cache-first-feed-pages.md),
  [feed coverage](../../architecture/data/feed-coverage.md), and
  [event surface paging](../../architecture/data/event-surface-paging.md).
- Crates: `lkjstr-app`, `lkjstr-storage`, `lkjstr-relays`, `lkjstr-ui`, and
  `lkjstr-web`.
- Shipped source paths: `crates/lkjstr-app/src/feed/`,
  `crates/lkjstr-storage/`, `crates/lkjstr-relays/`, `crates/lkjstr-ui/`,
  `src/lib/feed-surface/`, `src/lib/timeline/`, `src/lib/profile/`,
  `src/lib/thread/`, and `src/lib/notifications/`.
- Focused tests: `cargo test -p lkjstr-app -- feed`,
  `cargo test -p lkjstr-storage`, `cargo test -p lkjstr-relays`,
  `pnpm test -- tests/unit/feed-surface`,
  `pnpm test -- tests/unit/timeline/timeline-reducer.test.ts tests/unit/timeline/timeline-follow-loading.test.ts`,
  and `pnpm rust-wasm:quiet`.
- Completed enabling proof: `lkjstr-app` now has a pure row view model with
  stable event, profile, notification, unavailable, diagnostic, and footer row
  ids. Focused tests cover duplicate relay merge, explicit unavailable and
  diagnostic rows, profile and notification ids, footer states, first Rust Home
  row rendering, Home one-scroll-owner row-flow proof, Home long-post segmented
  plus horizontal-overflow, multiline, tall-text scroll-continuity, late
  profile hydration anchor, reference-preview hydration anchor, media-resize
  growth/shrink, pane-width growth/shrink, live-insert top/non-top anchor, Home
  structural scroll-owner boundary, converted feed structural, pane-body,
  horizontal-overflow, oversized Profile-note wrapping, Public Chat, and lkjstr Log scroll-owner proof, and
  event LOD/profile/notification shell anchor browser proofs, first injected Global feed rendering, Global
  selected-relay cache provider proof, exact Global coverage proof, bounded Home and Global
  relay snapshot wiring, Global one-scroll-owner row-flow proof, Global
  explicit/scroll/viewport-fill older request proof with compound older relay cursors,
  feed regressions, protocol events,
  Home and Global browser cleanup, first Notifications cached provider proof,
  Notifications
  browser cleanup, exact Notifications account coverage, bounded Notifications
  relay snapshot wiring, cache-complete initial-read suppression plus empty
  exact-window older probing, Notifications chrome/source-event scroll-owner/overflow and cursor-gating proof,
  Notifications bounded older relay-window proof, explicit Notifications older
  footer command wiring from retained relay state, scroll-triggered
  Notifications older request proof, Profile storage-backed provider proof,
  Profile one-scroll-owner row-flow proof, exact Profile route coverage, Profile metadata/follow-list exclusion, cached
  Profile metadata/follow-count rendering, Profile relay header refresh,
  Profile Followees/User Timeline/Profile Edit/copy-npub/nprofile/follow-list/relay-set JSON actions,
  Profile Follow/Unfollow state loading plus local and NIP-07 publish without fake success,
  Profile sparse-history empty proof, first Rust Followees NIP-02 row rendering,
  default cached plus selected-relay/stored-route/disabled-route Followees
  host-provider, one-scroll-owner proof, cleanup, read-command cleanup, retry diagnostics, root row
  actions with explicit copy status, and Rust island host proof,
  first Rust User Timeline NIP-02 author-set feed-row rendering,
  default cached User Timeline host-provider and one-scroll-owner proofs,
  target-posts-only fallback proof, public no-route/loading discovery-state
  tests, selected-relay User Timeline kind `3` discovery, stored NIP-65 route
  discovery, cleanup, read-command cleanup, retry diagnostics, incomplete status detail and Stats reason proof, and Rust island host proof,
  Thread cached root/reply provider proof, Thread one-scroll-owner row-flow
  proof, shared feed owner-release cleanup, bounded Thread bootstrap relay reads, Thread relay
  owner cleanup, explicit Thread older-page relay reads from the footer command,
  scroll-triggered and viewport-fill Thread older requests, bounded Thread live
  reply windows, focused-reference Thread hydration, bounded cached Thread
  parent-chain hydration, terminal unavailable-parent rows, Thread continuation
  rows, Search app/UI demand, worker-backed Search provider execution, local
  indexed rows, Search one-scroll-owner row-flow proof, bounded relay NIP-50 merge proof, Search tab snapshot restore,
  cached plus relay older-page proof, Custom Request durable geometry model proof, injected, worker-cached, relay-backed,
  exact-anchor, stored-route, unavailable-state, and one-scroll-owner Author Context rows, Rust
  row actions, shared Rust event action rendering, host-backed Rust event-id
  copy actions with retained-compatible status text/reset, copy-only menu proof,
  converted action providers, nearby-author menus across converted Rust feed
  rows, shared Rust event body, Author Context request-level cleanup guards,
  full FeedViewModel action/repost summary rows and verified nested repost
  target rows with UI attribute proof, Rust/TypeScript declared-target mismatch
  rejection, and nested-repost reservation invalidation,
  `FeedEventRow` content/action rows, indexed unavailable media/reference
  preview states with UI attribute proof, real HTTPS media rows with async image
  decode, fallback open-link attributes, compact media-only row ids,
  unavailable reference rows with real event identity and relay hints,
  inline event-reference token suppression before Rust row planning, safe HTTPS
  links with stable identity and media-backed URL suppression,
  identity-only NIP-19 profile mention rows plus presenter proof, profile-open
  and reference thread-open payload proof on converted Rust surfaces with real
  openers, normalized event/profile relay hints, custom emoji async/fallback
  rows, row dispatch/activation, opener parity, Author Context reuse,
  link/media open-button isolation, profile/event mention/reference proof,
  reaction/repost actor-row chrome, notification repost event rows, shared
  author metadata/avatar chrome, sensitive-warning propagation proof, common state-row rendering,
  shared footer shell rendering across converted feed rows, in-flight older
  footer visibility when `hasOlder` is temporarily false, retained Svelte copy
  actions with explicit clipboard failure states, and retained optional Svelte
  event/profile actions plus Rust-island hosts suppress unavailable no-op
  actions, empty Rust action menus, unavailable Thread continuation buttons,
  and Rust older-load controls without real older provider handlers are
  suppressed; released Global, Notifications, Search, and Thread older-provider
  leases suppress late completions; their command helpers release replaced or
  unsupported/blocked requests before dispatch; Search primary query commands
  release replaced or provider-unavailable leases; Custom Request run commands
  release replaced or provider-unavailable leases through the same cancel/cleanup helper; Profile following-count actions
  require a real Followees opener, unused tab-snapshot no-op persistence construction is
  removed, Rust geometry runtime counters plus row-height key/tier helpers, injected row-height, scan
  optimizer count proof, and grouped hint-status Stats rows are exposed, split
  Rust/WASM browser plus release gates, canonical Rust/WASM quiet wrapper proof,
  and Docker final-gate proof. Generic feed-host selection now has focused
  mount-key proof, and `pnpm check:repo` guards product source from re-importing
  retained Svelte feed tab bodies, TimelineTab support files, deleted feed tab wrappers,
  retired Author Context loaders, removed feed-surface staging/key/intent/notification-row helpers, Profile/Thread/Search/Custom Request imports,
  and Follow Graph/User Timeline runtime imports. Home, Global, Profile, Thread, Notifications, Search,
  Custom Request, Author Context, Followees, and User Timeline use generic Rust
  island host glue, which cancels pending WASM mounts when hidden or destroyed,
  unmounts late handles before accepting stale mounts, and preserves Search and
  Custom Request filter snapshots through typed callbacks. The removed
  Author Context, Followees, and User Timeline Svelte wrappers stay absent
  through `pnpm check:repo`.
- Remaining completion proof: retained Svelte tree-list render/helper wiring now has
  focused presenter/helper proof; EventTreeList near-end observer ownership is a
  tested factory with idempotent disconnect and in-flight callback dedupe; row
  components avoid old menu imports, deleted feed-scroll key, near-end observer,
  and speculative older helpers are guarded absent by `pnpm check:repo`; broader
  feed-surface deletion prerequisites remain open. Missing coverage never proves
  absence, and no placeholder rows exist.
