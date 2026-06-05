# Current State

## Purpose

This document summarizes the implemented product state and the active contracts
for storage, relay work, memory, and verification. Detailed behavior lives in
the linked product, protocol, architecture, and operations pages.

## Product Surfaces

Read next: [product/README.md](product/README.md),
[product/workspace/README.md](product/workspace/README.md), and
[product/tools/README.md](product/tools/README.md).

- The root route opens the tiled workspace app.
- Clean launch focuses Welcome and also opens Accounts, Relay Settings, Home,
  Notifications, and Tweet.
- Home, Global, Public Chat, Profile, Thread, Notifications, Search, Custom
  Request, Author Context, Accounts, Relay Settings, Stats, Settings, Upload
  Settings, lkjstr Log, Mine npub, Profile Edit, and Welcome are implemented.
- Followees and User Timeline are relay-backed action-opened surfaces. Cache-hit
  real NIP-02 data may render immediately, cache misses start target discovery,
  and User Timeline can show a truthful target-posts-only degraded mode.
- New Tab includes a fixed `lkjsxc` choice that opens the public User Timeline
  for `0f38afb23cec30570ee64f9a4aa099229395ec3371c5fe867e09c9111480015d`.
- Search is treated as complete only when the local SQLite token index and
  relay NIP-50 merge tests pass. It must never fall back to full cached-event
  scans for normal local search.
- The old browser storage prompt is removed. Generic workspace tab snapshots
  and protected SQLite data remain; no special durable request feature remains.
- Tweet, replies, reposts, reactions, zaps, Blossom upload, NIP-96
  compatibility upload settings, NIP-98 auth, NIP-30 custom emoji,
  sensitive-content reveal, and event reference previews are implemented.
- Cloudflare Workers Static Assets is only a hosting target. It is not an app
  backend, account service, relay proxy, or storage service.

## Protocol Support

Read next: [protocol/README.md](protocol/README.md),
[protocol/nip-support.md](protocol/nip-support.md), and
[architecture/network/README.md](architecture/network/README.md).

- Implemented Nostr surfaces include NIP-01, NIP-02, NIP-05, NIP-07, NIP-10,
  NIP-11, NIP-18, NIP-19, NIP-25, NIP-28, NIP-30, NIP-36, NIP-50, NIP-51,
  NIP-57, NIP-65, Blossom/NIP-B7 upload, NIP-96, and NIP-98.
- Partial protocol targets include NIP-29 relay-based groups and NIP-89 client
  tags. NIP-89 settings and shared TypeScript public publish enrichment are
  implemented, but it remains partial until every write surface and display
  option is verified.
- Relay AUTH is diagnostic-only.
- Search combines cached matches with relay NIP-50 filters when selected relays
  support them.
- Relay reads render progressive snapshots. Partial relay failure is diagnostic
  and must not block reachable relays.
- Selected read relays are eligible correctness fallback relays for Home,
  Global, Notifications, Profile, and Thread. The orchestrator may schedule,
  stagger, suspend, or rotate eligible relays by visible demand, score, and
  budget, but missing reads never prove absence.
- Targeted reads may add bounded protocol-derived routes from NIP-65, NIP-02,
  entity or tag hints, event relay receipts, and local route evidence. Global
  stays selected-relay based.
- Disabled or removed relays stay excluded until the user restores them.
- NIP-11 relay metadata and NIP-65 suggestions come only from real protocol
  data. Suggestions require explicit import.
- Relay ingress uses app-owned byte and structure caps before expensive JSON or
  event parsing.
- Rust owns protocol codecs, event parsing, canonical serialization, event ID
  hashing, Schnorr checks, local signing, relay URL normalization, NIP-19,
  custom emoji, content warning, tag indexing, reaction parsing, action tags,
  relay-list parsing, Blossom descriptors, upload metadata parsing, NIP-98
  helpers, NIP-89 client-tag validation, NIP-29 group tag parsing, and NIP-02
  follow-list extraction.

## Storage State

Read next: [architecture/data/README.md](architecture/data/README.md),
[architecture/data/storage/README.md](architecture/data/storage/README.md), and
[architecture/data/sqlite-opfs/README.md](architecture/data/sqlite-opfs/README.md).

- Browser-owned data includes workspace layout, tabs, settings, accounts, local
  signing secrets, drafts, notifications, relay purpose lists, relay
  information, relay summaries, jobs, feed/page records, diagnostics, route
  evidence, and cached events.
- The durable product path is official SQLite WASM in a worker, backed by OPFS
  when available and by explicit temporary memory mode when OPFS cannot open.
- Main-thread app code must not open SQLite or OPFS directly. Product code calls
  typed repositories; repositories talk to the worker-owned storage kernel.
- Settings, workspace layout, tab snapshots, Accounts, local signing secrets,
  relay sets, Tweet drafts, event graph, tags, relay provenance, feed cursors,
  cached feed pages, tag lookup, local filter search, relay diagnostics, relay
  information, relay suggestions, author routes, route blocks, notifications,
  jobs, cache ledger summaries, cache metadata, protection snapshots, and
  retention deletion use the SQLite worker with memory fallback when workers are
  unavailable.
- Physical inventory, cache tool summaries, retention target checks, repair,
  and protection snapshots use SQLite paths. Old IndexedDB diagnostics are
  presence-only and never scan old rows.
- Storage inventory is SQLite-first. It reads SQLite table counts, cache ledger
  summaries, browser quota estimates, localStorage, Cache Storage, and old
  IndexedDB database presence diagnostics without scanning every old row.
- Stats must read SQLite health and storage mode on startup. A loading row is
  short-lived only; after a bounded deadline Stats shows available, temporary
  memory, unavailable, timeout, blocked, corrupt, or unknown-old-storage.
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
  demands while retaining bounded windows.
- Tab snapshots are owned by `workspaceId + tabId`. They store compact scroll
  anchors, feed cursors, bounded row ids, and recoverable filter fields. They do
  not store full events, profiles, diagnostics, active workers, or unbounded
  arrays.
- Feed surfaces share near-end sentinels, footer phase semantics, bounded
  viewport-fill, older-load intent gating, and staged row shells on Home,
  Global, Profile, Thread, and Notifications.
- Live inserts follow a top-anchor policy. A user at the top sees new resident
  rows immediately; a user away from the top keeps the visible anchor and sees
  newer-available state instead of being yanked upward.
- Profile following counts are not binary. Unknown counts render loading,
  discovery, incomplete, unavailable, or failed states; only a known kind `3`
  follow list may render `0 following`.
- Profile notes do not show a no-notes empty state until sparse historical relay
  scans prove absence for attempted routes. Long-inactive profiles remain in a
  loading, searching older, partial, auth-required, failed, or unavailable state
  until proof exists.
- Visibility-prioritized hydration is the feed enrichment policy: visible rows,
  then near-visible rows, then active offscreen work, then hidden diagnostics.
- Cache-first feed display requires complete coverage evidence for every
  required relay, route group, semantic key, filter shape, and bounded interval.
  Incomplete, failed, compacted, dense, stale, or missing evidence cannot prove
  absence.
- Rust owns pure feed row geometry estimates, width-bucketed measured-height
  model updates, anchor compensation, long-content visual-fragment planning,
  and a pure real-data feed LOD tree. The shipped Svelte feed may use temporary
  bridge glue until Leptos feed parity is proven. LOD forgetting degrades
  low-value branches from full rows to shells, blocks, and recovery recipes
  without creating fake rows.

## Network And Runtimes

Read next: [architecture/network/README.md](architecture/network/README.md),
[architecture/runtimes/README.md](architecture/runtimes/README.md), and
[architecture/orchestration/README.md](architecture/orchestration/README.md).

- Surfaces submit demands. The subscription orchestrator plans shared leases
  and issues reads through the subscription manager.
- Feed route isolation keeps Home and Profile route-group reads on resolved
  route fingerprints, while Notifications and selected-relay tools keep
  independent semantic keys.
- User Timeline chunks large author sets, renders fast relay results before slow
  relay completion, and degrades to target-authored posts only when follow-graph
  discovery is unavailable but real target posts are reachable.
- Search renders local indexed results without waiting for remote relays, sends
  bounded NIP-50 filters to eligible selected read relays, and reports unsupported
  or clamped relays as diagnostics.
- Matching Home tabs attach to one shared query keyed by account, selected
  relays, page size, and feed policy.
- Background work is owner-scoped, cancellable, chunked, and non-blocking.
  Storage compaction, repair, physical inventory, optimizer persistence,
  profile hydration, reference hydration, relay metadata refresh, app-log
  trimming, and LOD materialization run through queued tasks.
- Stats, `__lkjstrMemoryDebug()`, and `window.__lkjstrDebug` expose
  orchestration demand, lease, event intake, storage operation, scan optimizer,
  storage pressure, and memory counters.
- Relay publish waiters, paged read leases, deduped read abort listeners, relay
  final-close state, idle pool eviction, and background tasks have cleanup
  tests.
- Runtime counters use static aggregate keys only.

## Memory And Retention

Read next: [architecture/data/heap-retention.md](architecture/data/heap-retention.md),
[architecture/data/resource-ownership.md](architecture/data/resource-ownership.md),
and [operations/memory-verification.md](operations/memory-verification.md).

- Automated memory gates use focused cleanup tests, runtime counters, bounded
  collection tests, storage-operation settlement tests, and retention tests.
- Browser heap snapshots and long-session observations are manual diagnostics,
  not canonical automated gates.
- Relay diagnostic summaries are bounded in memory. Storage diagnostics avoid
  full old-store scans.
- Runtime-visible and open-reference cache pins are owner-scoped, bounded, and
  cleaned up on owner teardown.
- Cache pressure records protected data, prunable cache, unknown storage, and
  residual browser overhead separately.

## Open Contracts

- SQLite worker storage is the active durable-storage contract. Product modules
  must use typed repositories and must not add direct browser database access.
- Followees and User Timeline are active product contracts. They must render
  real NIP-02 data or explicit unavailable states and must not synthesize users
  or posts. A local cache miss is a relay discovery trigger, not proof that a
  public follow list is unavailable.
- NIP-89 client tags are opt-in and must be added before signing only when a
  valid handler coordinate and relay hint exist.
- NIP-29 groups must use relay plus group id, `h` tags, relay-scoped state, and
  real relay data; do not implement raw kind `29`.
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
- Blossom/NIP-B7 upload is the preferred media target. Configured Blossom
  uploads use raw blob transport, scoped signed auth, and descriptor-hash
  validation. NIP-96 remains a compatibility provider path.
- RSS remains diagnostic-only for memory verification; app JavaScript heap is
  the owned browser memory assertion when manually measured.

## Canonical Docs

- [product/README.md](product/README.md): user-facing behavior.
- [protocol/README.md](protocol/README.md): protocol contracts.
- [architecture/README.md](architecture/README.md): runtime and data ownership.
- [architecture/data/sqlite-opfs/README.md](architecture/data/sqlite-opfs/README.md):
  SQLite OPFS storage target.
- [architecture/data/storage/README.md](architecture/data/storage/README.md):
  current storage kernel and retention contract.
- [architecture/orchestration/README.md](architecture/orchestration/README.md):
  browser-local background and decision orchestration.
- [architecture/rust-wasm/README.md](architecture/rust-wasm/README.md):
  Rust/WASM target ownership.
- [architecture/data/feed-surface/README.md](architecture/data/feed-surface/README.md):
  shared feed list contracts.
- [operations/verification.md](operations/verification.md): verification gate.
- [repository/documentation-standards.md](repository/documentation-standards.md):
  documentation and repository rules.

## Verification Gate

Docker Compose is the final verification path: validate Compose config, build
`app`, `verify`, `cloudflare`, and `app-smoke`, then run `verify`,
`cloudflare`, and `app-smoke` services from those images. Canonical local gates
are repository checks, focused unit and integration tests, Rust/WASM checks,
production build, Cloudflare dry-run, and app-smoke.
