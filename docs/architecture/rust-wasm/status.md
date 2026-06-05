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
- `lkjstr-web` owns typed browser adapters for IndexedDB, SQLite worker calls,
  relay WebSocket and timeout foundations, protocol parsing bridges, relay-score
  bridge calls, scan-model planning bridge calls, follow-graph parsing bridge
  calls, and early host calls needed by the partial Leptos shell.
- `lkjstr-relays` owns pure send queue, request scheduler, subscription id,
  subscription alias, close tombstone, request budget derivation, outbound `REQ`
  message-size budget, semantic page-read keys, in-flight page-read registry,
  progressive read snapshots, demand lease fingerprints, owner-registry state,
  route-plan grouping, ingress classification, live-lease host-effect reducer
  state, relay read scoring, route evidence trust, and deterministic ordering.
- `lkjstr-app` owns startup recovery, stored tab snapshot filtering, bounded warm
  tab snapshot staging, pure query-demand planning, feed-window reduction,
  adaptive grouped feed-scan planning, feed-scan traces, feed row geometry,
  feed width buckets, feed LOD tree reducers, target follow-graph reducers,
  feed wait and late merge reducers, initial orchestration decisions, feed
  live-runtime composition, surface query input builders, and a pure Custom
  Request parser and mode classifier.
- `lkjstr-ui` renders the partial Leptos workspace shell, Welcome, New Tab,
  Stats inventory, Settings, Accounts, Relay Settings, Upload Settings, and
  Tweet draft surfaces.

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
- Feed surfaces now have pure row geometry estimates, width buckets, anchor
  compensation, real-data LOD tree reducers, and Svelte width-bucketed session
  measurement. Durable SQLite geometry model wiring remains open.
- Rust Settings persistence now uses the SQLite worker typed repository in the
  Rust Settings host. CSS side effects and cache-budget enforcement remain open.
- Followees and User Timeline now have Rust target follow-graph reducers, a
  WASM parser bridge, a fixed lkjsxc catalog constant, follow-count state,
  author chunking contracts, cache-display policy reducers, and shipped Svelte
  relay-backed action wiring. Leptos surface parity and deletion of the Svelte
  tabs remain open.
- Feed windows own Rust top-anchor live-insert policy tests, and the shipped
  Svelte feed list consumes equivalent top-locked anchor behavior.
- Search now has a shipped SQLite token-index path in TypeScript storage glue.
  Rust tokenizer, query planner, and Leptos surface parity remain active.
- Hydration scheduling owns a Rust semantic-key priority reducer for visible,
  near-visible, hidden-paused, stale-generation, and deduped work. Product
  wiring beyond focused scheduler tests remains active.

## Open Foundations

- Product wiring for app query-demand plans, request budgets, page-read dedupe,
  progressive snapshot consumption, diagnostics merge, route-plan discovery
  integration, relay optimizer measurement, and Stats projection.
- Relay adapter product wiring from pure reducers to browser WebSocket and timer
  handles.
- Product SQLite wiring, cache delete and repair paths, retention dispatchers,
  and full ledger and byte inventory diagnostics.
- Product feed runtime wiring for Home, Global, Profile, Thread, Notifications,
  Search, Custom Request, and Author Context. Pure query inputs and feed-window
  reducers exist; shipped surfaces still use TypeScript.
- Rust completion evidence remains required before moving top-anchor policy,
  follow-count state, cache-display policy, search indexing, sparse profile
  scans, User Timeline runtime, or hydration scheduling out of active target
  status.
- Publish jobs, local signing flow integration, NIP-07 `signEvent`, media upload
  transport, custom emoji publish support, and Profile Edit publish.
- Full Leptos parity for every product surface and responsive browser QA.

## Runtime Rule

The SvelteKit runtime remains the shipped product until a Rust surface has real
behavior, matching tests, and no fake protocol or placeholder success state.
After a Rust surface reaches parity, delete the matching TypeScript or Svelte
module in the same coherent change and record the evidence in the cutover
ledgers.

## Next Order

1. Keep docs and ledgers current before code changes.
2. Keep the Rust/WASM quiet gate passing before expanding implementation.
3. Wire SQLite repositories into startup, Stats, and feed cache paths.
4. Wire relay reducers, request budgets, page-read dedupe, and browser adapters
   into product query services.
5. Wire scan density, orchestration, row geometry, and LOD into shipped feeds.
6. Delete replaced TypeScript or Svelte modules only after parity is proven.
