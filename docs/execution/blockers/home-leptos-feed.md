# First Home Leptos feed slice

## Purpose

First home leptos feed blocker details.

## Details

Render first Home Leptos feed rows from real Rust view models without claiming
broader surface parity.

- Cutover-ledger row: [Home](../../architecture/rust-wasm/cutover/implementation-ledger.md).
- Docs to read: [Home product](../../product/feeds/home.md),
  [followees product](../../product/feeds/followees.md),
  [Home runtime](../../architecture/runtimes/home-runtime.md),
  [Home feed source](../../architecture/feeds/sources/home.md), and
  [UI runtime](../../architecture/rust-wasm/ui-runtime.md).
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
  partial. The Rust Home island releases its provider lease on cleanup, suppresses
  late completions, and cancels the owner relay read so browser sockets and
  timers close. Browser startup proof mounts the Rust shell with unavailable
  storage, keeps Welcome usable, and renders explicit Home account and relay
  diagnostics instead of a success state.
- Remaining completion proof: broader feed-surface host wiring and TypeScript
  deletion proof remain open.
