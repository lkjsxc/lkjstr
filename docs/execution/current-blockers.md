# Current Blockers

## Purpose

This file lists the current Rust/WASM blockers in dependency order. Status:
implemented as an execution map; each blocker points to the contract, crates,
shipped source paths, tests, and proof needed to move a cutover-ledger row.

## Dependency Order

Storage wiring enables relay proof. The storage command-coverage and relay
host-runner enabling slices are implemented; storage and relay parity plus
deletion remain blocked. Shared feed runtime is the current first incomplete
blocker and has pure row-view-model, first Home rendering, cache-backed
provider, exact Home coverage proof, bounded Home relay snapshot wiring, Rust
Home owner-release cleanup, first Global rendering, Global cache-backed
provider proof, Global browser cleanup proof, Global footer/scroll and
viewport-fill older request proof, first Notifications cached
provider proof, Notifications browser cleanup proof, Notifications bounded
older relay-window plus footer and scroll-triggered older proof, and first
Profile storage-backed provider proof with exact route coverage and sparse
empty proof, plus first Thread cached root/reply provider proof, bounded
Thread bootstrap relay-read proof, explicit Thread older-page relay command
proof, scroll-triggered plus viewport-fill Thread older request proof, bounded
Thread live reply-window proof, focused-reference Thread hydration proof,
bounded cached Thread parent-chain proof, terminal unavailable-parent rows,
and Thread continuation rows; the shared Rust feed core now proves owner
release cleanup plus Search app/UI demand, provider execution, local indexed
rows, bounded relay NIP-50 merge proof, Search tab snapshot restore, cached
plus relay older-page proof, cached plus relay-refreshed Profile
metadata/follow-count header rendering, selected-relay plus stored-route
Followees/User Timeline kind `3` discovery, Followees/User Timeline cleanup,
retry diagnostics, and Svelte-hosted Rust island proof, first injected/cache/relay
Author Context rows, exact anchor lookup, stored routes, unavailable-state browser
proof, row actions, and Followees/User Timeline/Author Context request-level
cleanup guards. Global, Thread, Notifications, and Search older controls now
require a real provider older handler before rendering or dispatching older
loads, and the unused Rust workspace-persistence constructor that dropped tab
snapshots is removed. Profile following-count rows render as actions only when
a real Followees opener exists.
Do not skip this order for visible polish.

## 1. Storage command coverage (implemented enabling proof)

Preserve completed storage command coverage for retention, repair, full
pressure inventory diagnostics, and Rust Stats consumption.

Preserve implemented active selector, pressure, protected, event cache, feed
evidence, diagnostics, notifications, jobs, app log, inventory, optimizer,
retention, repair metadata and probes, and Search token, tag, and local-query
metadata.

- Cutover-ledger rows: [Protected tool storage](../architecture/rust-wasm/cutover/implementation-ledger.md)
  and [Event cache and feed evidence](../architecture/rust-wasm/cutover/implementation-ledger.md).
- Docs to read: [storage README](../architecture/data/storage/README.md),
  [SQLite OPFS README](../architecture/data/sqlite-opfs/README.md),
  [repository contract](../architecture/data/sqlite-opfs/repositories.md),
  [storage kernel](../architecture/rust-wasm/storage-kernel.md), and
  [storage wiring](../architecture/rust-wasm/cutover/storage-wiring.md).
- Crates: `lkjstr-storage`, `lkjstr-web`, `lkjstr-app`, and `lkjstr-ui`.
- Shipped source paths: `crates/lkjstr-storage/`,
  `crates/lkjstr-web/src/sqlite_store/`, `src/lib/storage/sqlite-opfs/`,
  `src/lib/storage/repositories/`, `tests/unit/cache/`,
  `tests/unit/events/repository.test.ts`, and
  `tests/unit/feed-surface/scan-model-repository.test.ts`.
- Focused tests: `cargo test -p lkjstr-storage`,
  `cargo test -p lkjstr-web`,
  `pnpm test -- tests/unit/cache tests/unit/events/repository.test.ts`,
  `pnpm test -- tests/unit/feed-surface/scan-model-repository.test.ts`, and
  `pnpm rust-wasm:quiet`.
- Completed proof: batch-capable Rust command specs cover implemented
  families, retention delete dispatch, repair metadata and probes, Search
  token, tag, and local-query metadata, current pressure byte projections,
  pressure-state mapping tests, UI Stats unavailable-state tests, storage-owned
  inventory readiness classification, and readiness-gated retention/repair app
  planning.
- Next queue: shared feed runtime. Preserve Search provider execution and
  snapshot restore proof, then return to feed/runtime storage consumers and
  broader storage parity only after their dependency rows are ready. Protected rows are never pruned;
  ledgers stay partial unless no-import proof exists.

## 2. Relay effect runner (implemented host mapping proof)

Wire Rust relay effects to browser WebSocket, timers, NIP-11 fetch, budgets,
page-read cleanup, and progressive snapshots.

- Cutover-ledger row: [Relay runtime](../architecture/rust-wasm/cutover/implementation-ledger.md).
- Docs to read: [network README](../architecture/network/README.md),
  [relay runtime](../architecture/rust-wasm/relay-runtime.md),
  [relay pool](../architecture/network/relay-pool.md),
  [relay routing](../architecture/network/relay-routing.md),
  [request budget](../architecture/network/request-budget/README.md), and
  [subscription orchestration](../architecture/network/subscription-orchestration/README.md).
- Crates: `lkjstr-relays`, `lkjstr-web`, and `lkjstr-app`.
- Shipped source paths: `crates/lkjstr-relays/`,
  `crates/lkjstr-web/src/relay*`, `src/lib/relays/`,
  `tests/unit/relays/`, `tests/unit/events/relay-page-scan.test.ts`, and
  `tests/unit/events/relay-page-adaptive-window.test.ts`.
- Focused tests: `cargo test -p lkjstr-relays`,
  `cargo test -p lkjstr-web`,
  `pnpm test -- tests/unit/events/relay-page-scan.test.ts tests/unit/events/relay-page-adaptive-window.test.ts`,
  and `pnpm rust-wasm:quiet`.
- Completed proof: `lkjstr-web` maps relay reducer effects to typed socket,
  frame, timer, NIP-11, diagnostic, snapshot, and callback-owner host actions.
  Typed host events feed reducer events only while the owner generation is
  active; closed owners emit ignored-after-close diagnostics and replaced
  generations are rejected. Firefox socket and timer host tests plus
  Rust/WASM quiet passed. Product surfaces still consume TypeScript relay
  runtime paths until shared feed demand wiring and no-import proof exist.

## 3. Shared feed runtime

Build shared feed runtime from strict cache proof, relay snapshots, row view
models, anchors, footer states, and unavailable states.

- Cutover-ledger row: [Shared feed runtime](../architecture/rust-wasm/cutover/implementation-ledger.md).
- Docs to read: [feeds README](../architecture/feeds/README.md),
  [feed runtime](../architecture/feeds/runtime/README.md),
  [feed surface](../architecture/data/feed-surface/README.md),
  [cache-first pages](../architecture/data/cache-first-feed-pages.md),
  [feed coverage](../architecture/data/feed-coverage.md), and
  [event surface paging](../architecture/data/event-surface-paging.md).
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
  row rendering, first injected Global feed rendering, Global selected-relay
  cache provider proof, exact Global coverage proof, bounded Home and Global
  relay snapshot wiring, Global explicit/scroll/viewport-fill older request
  proof with compound older relay cursors, feed regressions, protocol events,
  Home and Global browser cleanup, first Notifications cached provider proof,
  Notifications
  browser cleanup, exact Notifications account coverage, bounded Notifications
  relay snapshot wiring, Notifications scroll-owner and cursor-gating proof,
  Notifications bounded older relay-window proof, explicit Notifications older
  footer command wiring from retained relay state, scroll-triggered
  Notifications older request proof, Profile storage-backed provider proof,
  exact Profile route coverage, Profile metadata/follow-list exclusion, cached
  Profile metadata/follow-count rendering, Profile relay header refresh,
  Profile Followees/User Timeline/Profile Edit/copy-npub/nprofile/follow-list/relay-set JSON actions,
  Profile Follow/Unfollow state loading plus local and NIP-07 publish without fake success,
  Profile sparse-history empty proof, first Rust Followees NIP-02 row rendering,
  default cached plus selected-relay/stored-route/disabled-route Followees
  host-provider, cleanup, retry diagnostics, root row actions with explicit copy
  status, and Svelte-hosted Rust island proof,
  first Rust User Timeline NIP-02 author-set feed-row rendering,
  default cached User Timeline host-provider proof, public no-route/loading
  discovery-state tests, selected-relay User Timeline kind `3` discovery,
  stored NIP-65 route discovery, cleanup, retry diagnostics, and Svelte-hosted
  Rust island proof,
  Thread cached root/reply provider proof, shared
  feed owner-release cleanup, bounded Thread bootstrap relay reads, Thread relay
  owner cleanup, explicit Thread older-page relay reads from the footer command,
  scroll-triggered and viewport-fill Thread older requests, bounded Thread live
  reply windows, focused-reference Thread hydration, bounded cached Thread
  parent-chain hydration, terminal unavailable-parent rows, Thread continuation
  rows, Search app/UI demand, worker-backed Search provider execution, local
  indexed rows, bounded relay NIP-50 merge proof, Search tab snapshot restore,
  cached plus relay older-page proof, injected, worker-cached, relay-backed,
  exact-anchor, stored-route, and unavailable-state Author Context rows, Rust
  row actions, shared Rust event action rendering, host-backed Rust event-id
  copy actions, nearby-author menus across converted Rust feed rows, shared
  Rust event body, Author Context request-level cleanup guards,
  full FeedViewModel action/repost summary rows,
  `FeedEventRow` content/action rows, unavailable media/reference preview states,
  author metadata, sensitive-warning reveal rendering, common state-row rendering,
  shared footer shell rendering across converted feed rows, retained Svelte copy
  actions with explicit clipboard failure states, and retained optional Svelte
  event/profile actions plus Rust-island hosts suppress unavailable no-op
  actions, empty Rust action menus, unavailable Thread continuation buttons,
  and Rust older-load controls without real older provider handlers are
  suppressed; Profile following-count actions require a real Followees opener,
  unused tab-snapshot no-op persistence construction is removed, and Rust/WASM
  quiet.
- Remaining completion proof: Author Context Svelte-host no-import,
  event-row menu deletion readiness, and final-gate deletion readiness plus
  other feed-surface deletion prerequisites remain open.
  Missing coverage never proves absence, and no placeholder rows exist.

## 4. First Home Leptos feed slice

Render first Home Leptos feed rows from real Rust view models without claiming
broader surface parity.

- Cutover-ledger row: [Home](../architecture/rust-wasm/cutover/implementation-ledger.md).
- Docs to read: [Home product](../product/feeds/home.md),
  [followees product](../product/feeds/followees.md),
  [Home runtime](../architecture/runtimes/home-runtime.md),
  [Home feed source](../architecture/feeds/sources/home.md), and
  [UI runtime](../architecture/rust-wasm/ui-runtime.md).
- Crates: `lkjstr-app`, `lkjstr-storage`, `lkjstr-relays`, `lkjstr-ui`, and
  `lkjstr-web`.
- Shipped source paths: `crates/lkjstr-app/src/home*`,
  `crates/lkjstr-ui/src/home*`, `src/lib/timeline/`,
  `src/lib/tabs/timeline/`, `src/lib/backend/`, `tests/unit/timeline/`, and
  `tests/unit/workspace/tab-retention.test.ts`.
- Focused tests: `cargo test -p lkjstr-app -- home`,
  `cargo test -p lkjstr-ui -- home`,
  `pnpm test -- tests/unit/timeline/timeline-reducer.test.ts tests/unit/timeline/timeline-follow-loading.test.ts`,
  `pnpm test -- tests/unit/workspace/tab-retention.test.ts`, and
  `pnpm rust-wasm:quiet`.
- Completed enabling proof: `lkjstr-app` composes Home follow state, live query
  input, source state, shared feed rows, diagnostics, unavailable rows, and
  footer data. `lkjstr-ui` renders Home rows from `HomeFeedView`, and a browser
  WASM test proves an injected real event row plus cache-hit footer renders in
  the Rust Home tab. A host-provider browser test proves the default Rust Home
  tab can render real cached rows from protected SQLite account, relay,
  follow-list, event, and coverage repositories without fake data. The same
  browser proof keeps incomplete coverage partial and reaches ready only from
  exact feed, route, relay, filter, and interval coverage. Partial cache proof
  now starts a bounded selected-relay Home read that publishes real relay event
  snapshots into the same Rust view model while no-event terminal failures stay
  partial. The Rust Home tab releases its provider lease on cleanup, suppresses
  late completions, and cancels the owner relay read so browser sockets and
  timers close. Browser startup proof mounts the Rust shell with unavailable
  storage, keeps Welcome usable, and renders explicit Home account and relay
  diagnostics instead of a success state.
- Remaining completion proof: broader feed-surface host wiring and TypeScript
  deletion proof remain open.

## 5. Deletion proof

Prove imports are gone before deleting replaced TypeScript or Svelte product
paths.

- Cutover-ledger row: [Deletion ledger](../architecture/rust-wasm/cutover/deletion-ledger.md).
- Docs to read: [cutover README](../architecture/rust-wasm/cutover/README.md),
  [deletion ledger](../architecture/rust-wasm/cutover/deletion-ledger.md),
  [parity ledger](../architecture/rust-wasm/cutover/parity-ledger.md),
  [TypeScript inventory](../architecture/rust-wasm/cutover/typescript-inventory.md),
  and [workflow](../repository/workflow.md).
- Crates: replacement crate set named by the surface row.
- Shipped source paths: exact removed files under `src/lib/**` or
  `src/routes/**`, replacement Rust paths under `crates/lkjstr-*`, and tests
  under the surface focused gate.
- Focused tests: `rg` no-import proof for the target paths,
  `pnpm check:repo`, surface focused Rust tests, surface focused TypeScript
  tests while Svelte remains owner, `pnpm verify:quiet`, and Docker final gate
  before broad deletion claims.
- Completion proof: deletion ledger names removed files, replacement Rust paths,
  no-import command output, focused tests, and actual final-gate status. No
  partial row allows deletion.
