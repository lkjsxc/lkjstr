# Current State

## Purpose

This document summarizes the implemented product state and the active storage
cutover contract. Detailed behavior lives in the linked product, protocol,
architecture, and operations pages.

## Product Surfaces

Read next: [product/README.md](product/README.md),
[product/workspace/README.md](product/workspace/README.md), and
[product/tools/README.md](product/tools/README.md).

- The root route opens the tiled workspace app.
- Clean launch focuses Welcome and also opens Accounts, Relay Settings, Home,
  Notifications, and Tweet.
- Home, Global, Profile, Thread, Notifications, Search, Custom Request, Author
  Context, Accounts, Relay Settings, Stats, Settings, Upload Settings, lkjstr
  Log, Mine npub, Profile Edit, and Welcome are implemented.
- Tweet, replies, reposts, reactions, zaps, NIP-96 upload settings, NIP-98
  auth, NIP-30 custom emoji, sensitive-content reveal, and event reference
  previews are implemented.
- Cloudflare Workers Static Assets is only a hosting target. It is not an app
  backend, account service, relay proxy, or storage service.

## Protocol Support

Read next: [protocol/README.md](protocol/README.md),
[protocol/nip-support.md](protocol/nip-support.md), and
[architecture/network/README.md](architecture/network/README.md).

- Implemented Nostr surfaces include NIP-01, NIP-02, NIP-05, NIP-07, NIP-10,
  NIP-11, NIP-18, NIP-19, NIP-25, NIP-30, NIP-36, NIP-50, NIP-51, NIP-57,
  NIP-65, NIP-96, and NIP-98.
- Relay AUTH is diagnostic-only.
- Search combines cached matches with relay NIP-50 filters when selected relays
  support them.
- Relay reads render progressive snapshots. Partial relay failure is diagnostic
  and must not block reachable relays.
- Relay optimizer work is documented as a Rust/WASM target for measured scoring,
  route trust, scan density models, wait policy, and Stats projection. Rust owns
  pure relay read scoring, route-evidence trust, scan planning, and feed-wait
  reducers, storage row codecs, the relay-score WASM bridge, and the scan-model
  WASM bridge. Current product reads still rely on TypeScript wrappers until
  read-path wiring is complete; the product wiring ledger records each surface.
- Selected read relays remain the base and fallback for Home, Global,
  Notifications, Profile, and Thread. Targeted reads may add bounded
  protocol-derived routes, but Global remains selected-relay based.
- Clean storage seeds the `public-default` user set with public defaults plus
  Japanese and global Kiri relays. Existing user edits stay intact unless the
  user runs an explicit Relay Settings restore action.
- Disabled or removed relays stay excluded until the user restores them.
- NIP-11 relay metadata and NIP-65 suggestions come only from real protocol
  data. Suggestions require explicit import.
- Relay ingress uses app-owned byte and structure caps before expensive JSON or
  event parsing.
- Rust protocol support owns byte codecs, event parsing, frame policy checks,
  canonical event serialization, event ID hashing, Schnorr verification, local
  signing, relay URL normalization, NIP-19 entities, custom emoji helpers,
  content-warning helpers, tag indexing, reaction parsing, action tag builders,
  relay-list parsing, upload metadata parsers, and NIP-98 helpers.

## Storage State

Read next: [architecture/data/README.md](architecture/data/README.md),
[architecture/data/storage/README.md](architecture/data/storage/README.md), and
[architecture/data/sqlite-opfs/README.md](architecture/data/sqlite-opfs/README.md).

- Browser-owned data includes workspace layout, tabs, settings, accounts, local
  signing secrets, drafts, notifications, relay purpose lists, relay
  information, relay summaries, jobs, feed/page records, diagnostics, route
  evidence, and cached events.
- IndexedDB through Dexie is the current product durable path only until the
  storage cutover lands. It is deletion-only: new storage behavior targets the
  SQLite worker contract.
- The target durable path is official SQLite WASM in a worker, backed by OPFS
  when available and by explicit temporary memory mode when OPFS cannot open.
- Main-thread app code must not open SQLite or OPFS directly. Product code must
  call typed repositories; repositories talk to the worker-owned storage
  kernel.
- The SQLite schema, statement records, row codecs, retention classes, and
  worker adapter foundations already exist in Rust and TypeScript host code.
  Rust storage includes optimizer tables for relay observations, relay scores,
  expanded scan hints, and route evidence scores. The active contract adds scan
  observations, scan density models, and decision traces as recoverable
  optimizer rows, with SQLite worker host wrappers for scan model rows. The
  Svelte Settings, workspace layout, tab snapshot, Accounts,
  local signing secret, relay set, Tweet draft, event graph, tag, relay
  provenance, feed cursor,
  cached feed page, tag lookup, local filter-search, relay diagnostics, relay
  information, relay suggestions, author routes, route blocks, notifications,
  and job paths now use the SQLite worker with memory fallback when Workers are
  unavailable. Cache ledger summaries, cache metadata, protection snapshots,
  and retention deletion also use SQLite.
- Cache-first traversal now runs above relay reads for Home, Global, Profile
  post pages, and safe Custom Request event-list reads. Complete coverage
  returns SQLite rows without relay I/O; partial coverage renders cached rows
  and starts uncovered relay work in the background. Notifications still need
  the same top-level return path.
- Remaining Dexie cutover work is limited to repair, physical inventory, cache
  tool actions, app log rows when still open, any residual product readers or
  writers, and deletion of `src/lib/storage/browser-db.ts` plus Dexie metadata
  once no caller remains.
- Protected records are never removed by cache cleanup: accounts, local signing
  secrets, settings, relay sets, workspace state, Tweet drafts, active tab
  snapshots, active jobs, and route blocks.
- Recoverable cache rows are removed only through cache ledger policy. Runtime
  feed windows remain bounded; durable cached events are governed by explicit
  retention and diagnostics rather than a fixed small row count.
- Storage failure must recover to a usable Welcome workspace. Persistent OPFS
  mode and temporary memory mode must be visible in Stats or Settings.

## Workspace And Feeds

Read next: [architecture/workspace/README.md](architecture/workspace/README.md),
[architecture/feeds/README.md](architecture/feeds/README.md), and
[architecture/data/feed-surface/README.md](architecture/data/feed-surface/README.md).

- Pointer tab dragging is canonical. Native desktop drag uses pane chrome
  exclusion and pane-body edge detection for splits.
- Tab rails scroll horizontally with long-press touch drag, pointer capture,
  selection suppression, strip-priority reorder, and active-tab reveal.
- Inactive workspace tabs keep hidden mounted bodies; feed runtimes release live
  Demands while retaining bounded windows.
- Tab snapshots are owned by `workspaceId + tabId`. They store compact scroll
  anchors, feed cursors, bounded row ids, and recoverable filter fields. They do
  not store full events, profiles, diagnostics, active workers, or unbounded
  arrays.
- Feed surfaces share near-end sentinels, footer phase semantics, bounded
  viewport-fill, older-load intent gating, and staged row shells on Home,
  Global, Profile, Thread, and Notifications.
- Visible feed rows obey canonical newest-first ordering, merge by event id, and
  stay inside local display bounds.
- Cache-first feed display requires complete coverage evidence for every
  required relay, route group, semantic key, filter shape, and bounded interval.
  Incomplete, failed, compacted, dense, stale, or missing evidence cannot prove
  absence. A proven warm page should render from SQLite before profile
  hydration, reference hydration, diagnostics, or relay bootstrap.
- Home, Global, Profile posts, Notifications, and time-windowable Custom Request
  feeds use adaptive grouped scans. The target contract is durable scan density
  models plus last-span hints; both are performance input only and must never
  prove absence, suppress uncovered relays, or replace interval-union coverage.
  Exact id reads, search reads, Author Context, Thread context, metadata,
  follow-list lookup, and reference resolution keep exact request semantics.
- Rust now owns pure feed row geometry estimates, measured-height model updates,
  anchor compensation, and a pure real-data feed LOD tree. Feed-surface docs
  require row height reservation from measured geometry and LOD blocks for heavy
  feeds. Product wiring remains incremental.

## Network And Runtimes

Read next: [architecture/network/README.md](architecture/network/README.md) and
[architecture/runtimes/README.md](architecture/runtimes/README.md).

- Surfaces submit Demands. The subscription orchestrator plans shared Leases and
  issues reads through the subscription manager.
- Feed route isolation keeps Home and Profile route-group reads on resolved
  route fingerprints, while Notifications and selected-relay tools keep
  independent semantic keys.
- Relay Settings owns user and discovery relay sections. User relays drive
  runtime reads and writes. Discovery relays are limited to metadata and kind
  `10002` discovery.
- Matching Home tabs attach to one shared query keyed by account, selected
  relays, page size, and feed policy.
- Stats and `__lkjstrMemoryDebug()` expose orchestration demand, lease, event
  intake, storage operation, and memory counters. Rust now owns initial pure
  orchestration decisions for cache mode, selected relay reads, prefetch,
  hydration, and retention hints. Stats shows real in-memory relay score and
  scan hint snapshots, plus durable scan density rows and decision traces when
  SQLite storage is available. Durable orchestration, row geometry, and LOD
  providers remain open.
- Relay publish waiters, paged read leases, deduped read abort listeners, relay
  final-close state, and idle pool eviction have cleanup tests.
- Runtime counters use static aggregate keys only.

## Memory And Retention

Read next: [architecture/data/heap-retention.md](architecture/data/heap-retention.md),
[architecture/data/resource-ownership.md](architecture/data/resource-ownership.md),
and [operations/memory-verification.md](operations/memory-verification.md).

- Production-build Playwright memory tests enforce heap deltas and zero teardown
  counters for paged reads, read waiters, publish waiters, abort listeners, and
  storage operations.
- Relay diagnostic summaries are bounded in memory. Current IndexedDB list reads
  are capped while the SQLite cutover is in progress.
- Runtime-visible and open-reference cache pins are owner-scoped, bounded, and
  cleaned up on owner teardown.
- Cache pressure records protected data, prunable cache, unknown storage, and
  residual browser overhead separately.

## Open Contracts

- SQLite worker storage is the active durable-storage contract. Product paths
  that still read or write Dexie must move to typed SQLite repositories, then the
  Dexie dependency and binding must be deleted.
- Passkey-protected local secret storage is a follow-up product contract: it
  must actually encrypt local signer secrets with Web Crypto and WebAuthn PRF
  when supported, and show an unsupported state when the browser cannot do so.
- Encrypted direct messages are a follow-up product contract. The forward path
  is NIP-17 with NIP-44 and NIP-59; do not add fake message previews or make
  NIP-04 the primary new feature.
- Wallet custody is out of scope; zap support opens or copies invoices only.
- Broad runtime instrumentation remains limited to explicit runtime counters,
  compact memory counters, storage diagnostics, recoverable optimizer and
  orchestration traces, and persisted job records.
- Remote NIP-50 results depend on actual relay support.
- RSS remains diagnostic-only for memory verification; app JavaScript heap is
  the owned browser memory assertion.

## Canonical Docs

- [product/README.md](product/README.md): user-facing behavior.
- [protocol/README.md](protocol/README.md): protocol contracts.
- [architecture/README.md](architecture/README.md): runtime and data ownership.
- [architecture/data/sqlite-opfs/README.md](architecture/data/sqlite-opfs/README.md):
  SQLite OPFS storage target.
- [architecture/data/storage/README.md](architecture/data/storage/README.md):
  current storage kernel and retention contract.
- [architecture/rust-wasm/README.md](architecture/rust-wasm/README.md):
  Rust/WASM target ownership.
- [architecture/backend/README.md](architecture/backend/README.md):
  browser-local backend contract.
- [architecture/data/feed-surface/README.md](architecture/data/feed-surface/README.md):
  shared feed list contracts.
- [operations/verification.md](operations/verification.md): verification gate.
- [operations/sqlite-opfs-testing.md](operations/sqlite-opfs-testing.md):
  SQLite OPFS verification.
- [repository/documentation-standards.md](repository/documentation-standards.md):
  documentation and repository rules.

## Verification Gate

Docker Compose is the final verification path: validate Compose config, build
`app`, `verify`, `e2e`, `cloudflare`, and `app-smoke`, then run `verify`,
`e2e`, `cloudflare`, and `app-smoke` services from those images.
