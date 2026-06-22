# Active Target Slices

## Purpose

Active rust target slices.

## Details

- Scan-width adaptation now has pure density planning, optimizer storage rows,
  host SQLite wrappers, WASM bridge functions, raw hint-status traces, grouped
  Stats hint-status rows, and SvelteKit Vite-hosted WASM loading for initial
  scan span choice and observation reduction. Hosted builds degrade to an
  explicit bridge-unavailable state when `wasm-pack` is missing; Docker and
  Rust/WASM gates still prove the bridge compiles where Rust tools are present.
  Follow-up segment policy, reload proof, and synthetic relay proof remain open.
- Orchestration now has pure Rust decisions for cache mode, relay fallback,
  prefetch, hydration, and retention hints. SQLite-backed decision memory and
  shipped runtime wiring remain open.
- Feed surfaces now have pure content-aware row geometry estimates, width
  buckets, content-shape hashing, anchor reducers, real long-content visual
  fragmentation, real-data LOD tree reducers, and Svelte width-bucketed session
  measurement. WASM bridge calls now expose estimation, measurement reduction,
  visual-fragment planning, anchor capture, and anchor reconciliation. The
  shipped Svelte feed now warms that bridge, falls back to the equivalent
  temporary TypeScript estimator when unavailable, and decomposes oversized
  event rows into real visual fragments. Rust now has an unload-stable
  height-reservation reducer and the shipped Svelte bridge preserves active
  reservations through lighter row representations. Active implementation
  targets are SQLite observation persistence, deeper Stats diagnostics, and
  broader Leptos feed use. Durable SQLite geometry model wiring exists for Home,
  Global, Notifications, Profile, Thread, Search, Author Context, and User
  Timeline cached rows; converted event snapshots and Profile header relay
  rebuilds preserve cache-loaded models. Stats shows row-height table counts
  and bounded Rust/WASM runtime geometry counters; browser scroll proof remains
  open.
- Rust protected tool hosts now use the SQLite worker typed repositories for
  startup, workspace persistence, Settings, Accounts, Relay Settings, Upload
  Settings, Tweet drafts, Stats inventory, and Stats SQLite health. Rust also
  has active-account selector and pressure snapshot row commands, and Accounts
  resolves the active selector through SQLite with the old localStorage key as a
  migration source only. The active-selector task is closed evidence, and the
  command metadata shape now supports batch-shaped specs for active selector and
  pressure commands. Current storage work has Rust retention planning, command
  metadata, delete dispatch through `lkjstr-web` worker batches, Search token
  rows, Search command metadata, local indexed query adapters, repair physical
  target probes, explicit Rust Stats storage-action capability states, and a
  report-only Rust repair host action. Compact stays disabled with an explicit
  missing-adapter reason. Mutating repair/compaction action
  adapters, CSS side effects, and cache-budget enforcement remain open.
- Followees and User Timeline now have Rust target follow-graph reducers, a
  WASM parser bridge, a fixed lkjsxc catalog constant, follow-count state,
  author chunking contracts, cache-display policy reducers, a Rust User Timeline
  discovery planner, first Leptos Followees rows, a default cached Followees
  host provider, first Leptos User Timeline feed rows from injected real NIP-02
  data, default cached User Timeline host provider, selected-relay kind `3`
  discovery for Followees/User Timeline, Followees/User Timeline stored route-group
  discovery with disabled-route exclusion, Followees/User Timeline cleanup, and
  Followees retry plus User Timeline retry/auth/rate-limit/timeout and partial
  route diagnostics plus exact cache coverage proof. User Timeline keeps real
  cached target-authored posts as target-posts-only output after exhausted
  follow-list discovery. The Rust root Followees tab wires row-click Profile
  plus overflow Timeline and Copy npub callbacks with copy completion status.
  Followees headers and rows now use cached kind `0` display names, NIP-05
  subtitles, and avatars when present, with non-raw fallbacks instead of
  compact raw pubkeys.
  The shipped workspace mounts Followees through the generic Rust-island host
  plus typed mounter with the same row actions and unmount callbacks; the
  shipped User Timeline tab uses the same generic host pattern with profile,
  thread, Author Context, and unmount callbacks. Deletion remains open.
- Feed windows own Rust top-anchor live-insert policy tests, and the shipped
  Svelte feed list consumes equivalent top-locked anchor behavior.
- Search now has a shipped SQLite token-index path in TypeScript storage glue,
  Rust storage token rows, command metadata, local query adapters, app-owned
  submitted-query demand, a Leptos shell, and a worker-backed Rust provider for
  local indexed rows plus bounded relay NIP-50 snapshots, tab snapshot query
  restore, and cached older pages. Relay older pages and product parity remain active.
- Author Context now has a pure Rust feed view over shared feed rows, explicit
  missing event/author/relay/anchor states, a Leptos body, provider bridge, and
  Chrome proof from injected real `NostrEvent` rows plus worker-cached anchor
  and nearby author rows plus bounded selected-relay reads and row actions.
  The shipped Svelte tab now mounts that Rust body as a WASM island with
  unmount cleanup. Exact anchor lookup and stored author routes are wired;
  no-import proof and deletion remain open.
- Hydration scheduling owns a Rust semantic-key priority reducer for visible,
  near-visible, hidden-paused, stale-generation, and deduped work. Product
  wiring beyond focused scheduler tests remains active.
- Event display planning now has a Rust shared event and repost target planner
  for renderer, unavailable state, chrome policy, and geometry context. Shipped
  Svelte components use shared content/media/reference rendering for nested
  repost targets while Leptos parity and full view-model wiring remain open.
