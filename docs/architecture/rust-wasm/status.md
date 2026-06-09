# Rust WASM Status

## Purpose

This file is the concise status map for the active Rust/WASM migration.

## Implemented Rust Slices

- `lkjstr-protocol` owns byte codecs, event parsing, frame policy checks,
  canonical event serialization, event ID hashing, filter matching, relay
  message basics, Schnorr verification, local signing, relay URL normalization,
  NIP-19 entities, NIP-30 helpers, NIP-36 warnings, tag indexing, reactions,
  action tags, NIP-51 emoji source helpers, NIP-57 zaps, NIP-65 relay-list
  metadata, Blossom upload descriptors and auth scopes, NIP-96 upload metadata,
  NIP-98 auth helpers, NIP-89 client-tag validation, NIP-29 group tag parsing,
  and NIP-02 follow-list extraction.
- `lkjstr-domain` owns account records, relay-set reducers, Tweet draft models,
  workspace layout reducers, tab movement, edge splits, clean startup,
  recovery, New Tab catalog data, and tab snapshot payload contracts.
- `lkjstr-storage` owns the executable table manifest, cache-ledger resource
  map, typed operation outcomes, executable SQLite schema records, protected,
  event-cache, diagnostics, and optimizer statements, schema hash, tab-state
  keys, ledger rows, and protected plus cache SQLite row codecs.
- `lkjstr-web` owns typed browser adapters for IndexedDB host-boundary tests,
  SQLite worker calls, SQLite-backed Rust startup, workspace persistence,
  Accounts, Relay Settings, Settings, Upload Settings, Tweet drafts, Stats
  inventory, Stats SQLite health, durable lkjstr Log reads and clears, relay
  WebSocket and timeout foundations, protocol parsing bridges,
  relay-score bridge calls, scan-model planning bridge calls, feed geometry,
  visual fragment, anchor bridge calls, and follow-graph parsing bridge calls.
- `lkjstr-relays` owns pure send queue, request scheduler, subscription id,
  subscription alias, close tombstone, request budget derivation, outbound `REQ`
  message-size budget, semantic page-read keys, in-flight page-read registry,
  progressive read snapshots, demand lease fingerprints, owner-registry state,
  route-plan grouping, ingress classification, live-lease host-effect reducer
  state, relay read scoring, route evidence trust, and deterministic ordering.
- `lkjstr-app` owns startup recovery, stored tab snapshot filtering, bounded warm
  tab snapshot staging, pure query-demand planning, feed-window reduction,
  adaptive grouped feed-scan planning, feed-scan traces, content-aware feed row
  geometry, content-shape hashing, long-content visual-fragment planning, pure
  feed anchor reducers, feed width buckets, feed LOD tree reducers,
  target follow-graph reducers, feed wait and late merge reducers, initial
  orchestration decisions, feed live-runtime composition, surface query input
  builders, and a pure Custom Request parser and mode classifier.
- `lkjstr-ui` renders the partial Leptos workspace shell, Welcome, New Tab,
  Stats inventory and SQLite health, Settings, Accounts, Relay Settings, Upload
  Settings, lkjstr Log durable rows, and Tweet draft surfaces.

## Active Target Slices

- Scan-width adaptation now has pure density planning, optimizer storage rows,
  host SQLite wrappers, WASM bridge functions, and SvelteKit Vite-hosted WASM
  loading for initial scan span choice and observation reduction. Hosted builds
  degrade to an explicit bridge-unavailable state when `wasm-pack` is missing;
  Docker and Rust/WASM gates still prove the bridge compiles where Rust tools are
  present. Follow-up segment policy, reload proof, synthetic relay proof, and
  Stats polish remain open before the ledger can mark full read-path parity.
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
  Leptos feed use. Durable SQLite geometry model wiring remains open.
- Rust protected tool hosts now use the SQLite worker typed repositories for
  startup, workspace persistence, Settings, Accounts, Relay Settings, Upload
  Settings, Tweet drafts, Stats inventory, and Stats SQLite health. Rust also
  has active-account selector and pressure snapshot row commands, and Accounts
  resolves the active selector through SQLite with the old localStorage key as a
  migration source only. The active-selector task is closed evidence, and the
  command metadata shape now supports batch-shaped specs for active selector and
  pressure commands. Current storage work has Rust retention planning, command
  metadata, and delete dispatch through `lkjstr-web` worker batches. Repair,
  full pressure byte inventory diagnostics, CSS side effects, and cache-budget
  enforcement remain open.
- Followees and User Timeline now have Rust target follow-graph reducers, a
  WASM parser bridge, a fixed lkjsxc catalog constant, follow-count state,
  author chunking contracts, cache-display policy reducers, a Rust User Timeline
  discovery planner, and shipped Svelte relay-backed action wiring with route
  diagnostics. Leptos surface parity and deletion of the Svelte tabs remain
  open.
- Feed windows own Rust top-anchor live-insert policy tests, and the shipped
  Svelte feed list consumes equivalent top-locked anchor behavior.
- Search now has a shipped SQLite token-index path in TypeScript storage glue.
  Rust tokenizer, query planner, and Leptos surface parity remain active.
- Hydration scheduling owns a Rust semantic-key priority reducer for visible,
  near-visible, hidden-paused, stale-generation, and deduped work. Product
  wiring beyond focused scheduler tests remains active.
- Event display planning now has a Rust shared event and repost target planner
  for renderer, unavailable state, chrome policy, and geometry context. Shipped
  Svelte components use shared content/media/reference rendering for nested
  repost targets while Leptos parity and full view-model wiring remain open.

## Open Foundations

- Product wiring for app query-demand plans, request budgets, page-read dedupe,
  progressive snapshot consumption, diagnostics merge, route-plan discovery
  integration, relay optimizer measurement, and Stats projection.
- Relay adapter product wiring from pure reducers to browser WebSocket and timer
  handles.
- Feed-runtime SQLite wiring, repair physical probes, search/tag command
  metadata, and pressure plus byte inventory diagnostics. Retention delete
  dispatch and basic repair worker adapters are wired at the Rust boundary, but
  product consumption remains open.
- Product feed runtime wiring for Home, Global, Profile, Thread, Notifications,
  Search, Custom Request, and Author Context. Pure query inputs and feed-window
  reducers exist; shipped surfaces still use TypeScript.
- Rust completion evidence remains required before moving top-anchor policy,
  follow-count state, cache-display policy, search indexing, sparse profile
  scans, User Timeline runtime, or hydration scheduling out of active target
  status.
- Publish jobs, local signing flow integration, NIP-07 `signEvent`, media upload
  transport, custom emoji publish support, Profile Edit publish, and session log
  capture wiring for the Rust Log body.
- Full Leptos parity for every product surface and responsive browser QA.

## Runtime Rule

The SvelteKit runtime remains the shipped product until a Rust surface has real
behavior, matching tests, and no fake protocol or placeholder success state.
After a Rust surface reaches parity, delete the matching TypeScript or Svelte
module in the same coherent change and record the evidence in the cutover
ledgers.

## Next Order

Use [surface-cutover-order.md](surface-cutover-order.md) for dependency rank,
[cutover/implementation-ledger.md](cutover/implementation-ledger.md) for owner
and dependency rows, and [cutover/verification-ledger.md](cutover/verification-ledger.md)
for checks. Each executable slice records docs touched, Rust crates touched,
replaced TypeScript or Svelte paths, focused gate, and final gate.

### SQLite Feed And Diagnostics Wiring

- Docs touched: this file, [storage-kernel.md](storage-kernel.md),
  [../data/sqlite-opfs/repositories.md](../data/sqlite-opfs/repositories.md),
  [cutover/areas/storage.md](cutover/areas/storage.md),
  [cutover/parity-ledger.md](cutover/parity-ledger.md), and
  [cutover/deletion-ledger.md](cutover/deletion-ledger.md).
- Rust crates touched: `lkjstr-storage`, `lkjstr-web`, `lkjstr-app`, and
  `lkjstr-ui` when view-model fields change.
- TypeScript or Svelte paths replaced: none deleted until feed evidence,
  diagnostics, retention, tab snapshots, and no-import proof are complete.
- Current sub-slice: Stats consumes real SQLite worker health through the Rust
  storage worker adapter. Event-cache, feed-coverage, active-account selector,
  and pressure snapshot Rust row codecs plus `lkjstr-web` worker repository
  calls exist. Accounts now uses the SQLite active selector row and migrates the
  old localStorage key only when needed. Command metadata now has statement and
  table arrays plus ledger, protection, and Stats policy enums. Live protected,
  event cache, feed evidence, relay diagnostics, notifications, jobs, app log,
  pressure, and inventory worker calls now have command specs. Optimizer
  metadata, retention planner metadata, retention delete dispatch, and
  storage-owned repair command models plus basic worker adapters are
  implemented; repair physical probes, search/tag lookup, full product cache
  proof, and surface consumption remain open.
- Focused gate: `cargo test -p lkjstr-storage` and `pnpm rust-wasm:quiet`.
- Final gate: Docker Compose config, image builds, and service runs from
  [../../operations/verification.md](../../operations/verification.md).

### Relay Product Wiring

- Docs touched: [relay-runtime.md](relay-runtime.md),
  [../network/subscription-orchestration/README.md](../network/subscription-orchestration/README.md),
  and request-budget docs.
- Rust crates touched: `lkjstr-relays`, `lkjstr-web`, and `lkjstr-app`.
- TypeScript or Svelte paths replaced: `src/lib/relays` pieces only after
  synthetic relay proof and surface parity.
- Focused gate: `cargo test -p lkjstr-relays` and relay orchestration unit
  tests.
- Final gate: Docker Compose final gate.

### Shared Feed Runtime

- Docs touched: [../feeds/runtime/README.md](../feeds/runtime/README.md),
  [../data/feed-surface/README.md](../data/feed-surface/README.md), this file,
  and parity ledgers.
- Rust crates touched: `lkjstr-app`, `lkjstr-storage`, `lkjstr-relays`, and
  `lkjstr-ui`.
- TypeScript or Svelte paths replaced: `src/lib/feed-surface`, feed-specific
  runtime code, and tab surfaces only after Leptos parity.
- Focused gate: `cargo test -p lkjstr-app -- feed` plus feed surface unit tests.
- Final gate: Docker Compose final gate.

### Surface Cutover

- Docs touched: product feed or tool contract, runtime contract, parity ledger,
  deletion ledger, and concise audit.
- Rust crates touched: surface-specific `lkjstr-app` model, `lkjstr-ui` view,
  `lkjstr-web` host adapters, and shared lower crates as needed.
- TypeScript or Svelte paths replaced: exact module group in the deletion
  ledger.
- Focused gate: surface-specific gate from
  [../../operations/focused-gates.md](../../operations/focused-gates.md).
- Final gate: Docker Compose final gate before cutover claims.
