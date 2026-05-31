# Current State

## Purpose

This document summarizes the implemented state. Detailed contracts live in the
linked product, protocol, architecture, and operations pages.

## Product Surfaces

Read next: [product/README.md](product/README.md),
[product/workspace/README.md](product/workspace/README.md), and
[product/tools/README.md](product/tools/README.md).

- The root route opens the tiled workspace app.
- Clean launch uses a vertical root split: Welcome is focused in the top pane,
  and Accounts is active in the lower pane with Relay Settings, Home,
  Notifications, and Tweet already open.
- Home, Global, Profile, Thread, Notifications, Search, Custom Request, Author
  Context, Accounts, Relay Settings, Stats, Settings, Upload Settings, lkjstr
  Log, Mine npub, Profile Edit, and Welcome are implemented product surfaces.
- Tweet, replies, reposts, reactions, zaps, media upload settings, custom emoji,
  sensitive content reveal, and event reference previews are implemented.

## Protocol Support

Read next: [protocol/README.md](protocol/README.md),
[protocol/nip-support.md](protocol/nip-support.md), and
[architecture/network/README.md](architecture/network/README.md).

- Implemented Nostr support includes NIP-01, NIP-02, NIP-05, NIP-07, NIP-10,
  NIP-11, NIP-18, NIP-19, NIP-25, NIP-30, NIP-36, NIP-50, NIP-51, NIP-57,
  NIP-65, NIP-96, and NIP-98 surfaces documented in
  [protocol](protocol/README.md).
- Relay AUTH is diagnostic-only.
- Search uses cached matches plus NIP-50 relay filters when selected relays
  support them.
- Home, Global, Search, and Custom Request consume progressive relay read
  snapshots so partial rows can render before final relay coverage.
- Relay reads use relay plus request-context scoring for scheduling diagnostics.
  Scoring never becomes a correctness filter and never permanently suppresses
  enabled relays.
- NIP-11 relay information is parsed into typed top-level and limitation fields.
  Request budgets use app caps plus typed relay limits to clamp per-relay
  filters, compute read event caps, reject oversized `REQ` messages locally, and
  expose policy diagnostics without suppressing enabled read relays.
- Rust protocol support now implements byte codecs, event parsing, frame policy
  checks, event ordering, canonical event serialization, event ID hashing,
  filter matching, relay message basics, Schnorr verification, local signing,
  relay URL normalization, NIP-19 scalar plus TLV entity encoding and decoding,
  NIP-30 custom emoji helpers, NIP-36 content-warning helpers, tag indexing,
  reaction parsing, action tag builders, content-derived tag helpers, NIP-51
  emoji source helpers, NIP-57 zap helpers, NIP-65 relay-list metadata parsing,
  NIP-96 upload metadata parsers, and NIP-98 HTTP auth helpers.
- Home, Global, Profile posts, Notifications, and safe Custom Request event-list
  reads use an adaptive temporal window controller. Grouped scans start at `1`
  minute, double the next adjacent window after complete sparse relay-shaped
  reads, keep balanced successful spans unchanged, and halve dense windows when
  any contacted relay-shaped request reaches its effective limit.

## Ownership

Read next: [architecture/README.md](architecture/README.md),
[architecture/data/README.md](architecture/data/README.md),
[architecture/feeds/README.md](architecture/feeds/README.md), and
[architecture/workspace/README.md](architecture/workspace/README.md).

- Workspace layout, tabs, settings, accounts, local signing secrets, drafts,
  notifications, relay purpose lists, relay information, relay summaries, jobs,
  feed/page records, diagnostics, and cached events are browser-owned data.
- Pointer tab dragging is canonical. Native desktop drag uses pane chrome
  exclusion and pane-body edge detection for splits. Center and edge drop
  previews align with the content stack only and never cover the tab strip or
  tile menu row.
- Tab rails scroll horizontally with long-press touch drag, pointer capture,
  selection suppression, strip-priority reorder, and active-tab reveal.
- Protected user records and prunable local-cache records are separate
  ownership classes. Accounts, local signing secrets, settings, relay sets,
  workspace state, Tweet drafts, active tab snapshots, active jobs, and
  user-owned relay configuration are never deleted by cache cleanup.
- Durable local cache has no application item-count ceiling. `cache.maxBytes`
  defaults to `67108864` bytes and acts as the site storage target when browser
  estimates are available. `cacheLedger` implements shared byte-accounting
  across events, notifications, feed/page rows, recoverable relay diagnostics,
  protocol cache, route evidence, finished jobs, and stale snapshots. Compaction
  prunes the lowest-value recoverable resource class, not only cached events.
  Stats reports table-level storage inventory, ledger inventory, protected
  estimates, prunable estimates, and unexplained browser overhead so
  notification-heavy and page-heavy pressure can be diagnosed. Runtime feed
  windows remain bounded. The live durable table contract is maintained in the
  [Storage Manifest](architecture/data/storage/data-classes/table-manifest.md).
- Storage is browser-owned and manifest-driven. The table manifest defines every
  live IndexedDB table, its data class, inventory group, Dexie schema string,
  and retention flags. Ledger resource ownership and storage repository modules
  own resource-plus-ledger write boundaries for events, feed cache, jobs,
  notifications, relay diagnostics, relay information, route evidence, and tab
  snapshots.
- Feature modules call storage repositories instead of Dexie tables. The
  repository checker rejects direct `browserDb()` calls outside storage-owned
  modules and the temporary `src/lib/cache` compatibility area.
- Storage operations return typed results. UI paths may continue from memory
  fallback, while Stats can distinguish active, timed-out, late-settled, and
  late-rejected IndexedDB operations.
- Rust storage support now implements the executable table manifest, cache
  ledger resource ownership map, typed storage operation outcome contract, and
  tab-state key plus ledger-row contract. Rust workspace records round-trip
  through real `web_sys` IndexedDB workspace and settings adapters. Full
  repository, deadline, retention, and ledger transaction work remains open.
- Rust relay support now implements pure send queue, request scheduler,
  subscription id, subscription alias, and close tombstone state machines.
  WebSocket adapters and the full Rust relay client reducer are not yet
  implemented.
- Rust workspace support now implements pure layout, pane, tab, tab-group,
  clean startup, focus, open-tab, split-pane, move-tab, edge-drop split,
  close-tab, and usable-workspace recovery reducers, plus feed/tool tab
  snapshot payload and merge semantics. Rust domain support also owns the New
  Tab catalog labels, groups, descriptions, and active-account profile config.
  Rust app support now composes startup recovery and bounded tab snapshot
  staging. The Rust Leptos UI mounts a partial shell from `lkjstr-web`, renders
  startup panes and tabs from Rust reducers, opens Welcome action tabs, and
  converts New Tab choices while preserving the chooser tab id, persists tab
  actions through Rust IndexedDB, and renders real Rust Stats, Settings, Relay
  Settings, Upload Settings, Tweet drafts, and partial Accounts views with NIP-07 connection. Feeds, most tools, relay content, and full parity remain in TS.
- Relay ingress uses app-owned byte and structure caps before expensive JSON
  and event parsing.
- IndexedDB remains durable browser-owned data; memory relief prunes only
  bounded app-owned runtime windows, caches, counters, and fallback stores.
- Browser-local backend services own shared Home queries above tab components.
  Relay clients, relay pool, subscription orchestrator, subscription manager,
  and runtimes own network reads and deterministic cleanup.
- Surfaces submit Demands; the orchestrator plans shared Leases (canonical
  fingerprints with `channel` disambiguation) and issues reads through the
  subscription manager.
- Feed route isolation keeps Home and Profile route-group reads on resolved
  route fingerprints, while Notifications and selected-relay tools keep
  independent semantic keys.
- Relay Settings owns stacked user and discovery relay sections in one tab.
  User relays drive selected read/write runtime behavior. Discovery relays are
  editable but limited to metadata and kind `10002` relay-list discovery, and
  discovery-only URLs do not widen feed or content reads.
- Matching Home tabs attach to one shared query keyed by account, selected
  relays, page size, and feed policy. Tab ids own attachments only.
- Stats and `__lkjstrMemoryDebug()` expose orchestration demand, lease, and
  event intake counters. Stats labels active relay subscriptions by redacted
  human purpose and keeps raw ids secondary.
- Stats cache diagnostics tolerate blocked, corrupt, or schema-incomplete
  IndexedDB stores. Missing object stores are reported as unavailable or
  incomplete diagnostics rather than uncaught runtime exceptions.
- Inactive workspace tabs keep hidden mounted bodies; feed runtimes release live
  Demands while retaining bounded windows.
- Tab snapshots are owned by `workspaceId + tabId`; pane id is only last-placement
  metadata for capture. The workspace snapshot coordinator owns scroll owners,
  runtime snapshots, one-shot restore tokens, warm LRU snapshots (cap `32`), and
  IndexedDB `tabStates` reload restore.
- Durable snapshots store generic row scroll anchors, feed cursors,
  `hasOlder`/`hasNewer`, history exhaustion state, bounded event or
  notification ids, and recoverable filter fields. They never store full events,
  profiles, relay diagnostics, active workers, or unbounded arrays.
- Feed surfaces share `IntersectionObserver` near-end sentinels with scroll
  fallback, `feedPagingPhase` footer semantics, bounded viewport-fill for
  underfilled lists, older-load intent gating, and staged row shells on Home,
  Global, Profile, Thread, and Notifications.
- Feed rows are display-bound before presentation: future events and rows
  outside local `since`, exclusive `until`, `before`, or `after` bounds stay out
  of visible feed results.
- Complete feed coverage evidence can make cached display immediate only when
  every required relay, route group, semantic feed key, filter shape, bounded
  interval, and backing event row proves completion. Adjacent and overlapping
  complete rows may prove a bounded segment. If only some relays are proven,
  only uncovered relays are queried. Dense, incomplete, unresolved, failed,
  compacted, or missing evidence is not proof of absence and cannot suppress
  relay reads. Event compaction currently deletes all feed coverage rows
  conservatively so stale complete coverage cannot prove absence.
- Durable warm scan hints tune grouped feed scan initial spans only when every
  required relay/filter has fresh evidence. Hints are bounded, stale after `30`
  days, and never prove absence or suppress relay reads.
- Home, Global, Profile posts, Notifications, and time-windowable Custom Request
  feeds use adaptive grouped scans. Search, exact id requests, Custom Request
  filters with `ids` or `search`, Author Context, Thread reply pages, metadata,
  follow-list lookup, thread root lookup, and reference resolution keep exact
  request semantics.
- Feed correctness contracts live under
  [architecture/feeds](architecture/feeds/README.md): canonical ordering,
  merge-by-id reducer, per-tab page cursors, and independent notification
  filters.
- Progressive relay rendering is documented in
  [architecture/network/progressive-relay-rendering.md](architecture/network/progressive-relay-rendering.md).
- Virtual event lists use `EventTreeList` on Home, Global, Profile, Thread,
  Search, and Custom Request. Profile summary rows and note rows share the same
  `FeedScrollSurface` owner. Notifications uses Virtua flat listing with the
  same footer and near-end contract.
- Profile tabs hide visible initial-loading and manual newer-note controls while
  keeping internal loading and newer state. Older-pruned newer notes recover
  through automatic near-start behavior at the first event row, and the identity
  block spans the profile card width below the avatar/action row. Profile,
  Notifications, and Thread allow bounded viewport-fill only while the list is
  underfilled; after the list becomes scrollable, older history loads require a
  current downward scroll-owner gesture. Notifications keeps the scroll surface
  mounted for retryable zero-record windows and exposes an explicit older-scan
  command after bounded auto-fill attempts are spent.
- Event rows show nip05-only subtitles on feeds, pressed Heart/Repost styling
  from a hybrid action-state index plus feed evidence, keep optimistic
  published pressed state stable during cache refresh, and show no left-side
  new-event stripe.
- Welcome is a document-like quick-start with working links into Accounts,
  Relay Settings, Tweet, and core tabs.
- Relay publish waiters, paged read leases, deduped read abort listeners, relay
  client final close state, and idle pool eviction are covered by lifecycle
  cleanup tests.
- Runtime counters use static aggregate keys only, and `check:repo` rejects
  first-party source classes outside the Dexie database binding.
- Search, Custom Request, Author Context, Tweet, event rows, references, event
  lists, and anchored popovers guard async UI continuations after teardown.
- Cloudflare Workers Static Assets is a hosting target only; it does not add a
  backend account service, relay proxy, or Cloudflare storage dependency.

## Memory and Retention

Read next: [architecture/data/heap-retention.md](architecture/data/heap-retention.md),
[architecture/data/resource-ownership.md](architecture/data/resource-ownership.md),
and [operations/memory-verification.md](operations/memory-verification.md).

- Memory retention work is active. Historical symptoms included a retained heap
  approaching one gigabyte after heavy feed usage. Production-build Playwright
  memory tests (`pnpm test:e2e:memory`) now enforce heap deltas and zero
  teardown counters for paged reads, read waiters, publish waiters, abort
  listeners, and IndexedDB operations.
- Compact memory counters and `window.__lkjstrMemoryDebug()` expose redacted
  snapshots for e2e and Stats.
- Relay diagnostic summaries are bounded in memory and IDB list reads are
  capped; batched `bulkPut` reduces per-relay transaction churn.
- Runtime-visible and open-reference cache pins are owner-scoped and cleaned up
  on owner teardown. They protect compaction dynamically without becoming
  durable hard-protected priority rows. Dynamic protection scans are bounded;
  incomplete scans stop compaction rather than treating missing evidence as
  permission to delete.
- Cleanup ownership for every resource type is documented in
  [resource-ownership.md](architecture/data/resource-ownership.md).
- Heap snapshot collection, memory budgets, and the verification workflow are
  documented in [heap-retention.md](architecture/data/heap-retention.md) and
  [memory-verification.md](operations/memory-verification.md).
- Product polish tracked in [product/backlog.md](product/backlog.md) follows
  memory gate stability.

## Known Gaps

- Rust/WASM client architecture is partly started. Rust workspace checks and
  Rust protocol byte, event, event-ID, filter, relay-message, signing, and
  verification behavior are implemented. NIP-19 scalar and TLV entity behavior
  and relay URL normalization are implemented in Rust. `lkjstr-web` exposes
  those implemented protocol surfaces through browser-tested WASM bindings.
  `lkjstr-domain` implements pure account records, local secret row shape, local
  signing helpers, npub mining prefix rules, workspace reducers, tab snapshots,
  and the New Tab catalog. A partial Leptos workspace shell exists, but the
  product runtime remains the browser-first SvelteKit and TypeScript app until
  each Rust feed, tool, storage, relay, and UI surface reaches matching tests.
- Remote NIP-50 results depend on actual relay support.
- Passkey-protected local secret storage is design-only.
- Encrypted direct messages are not implemented.
- Wallet custody is out of scope; zap support opens or copies invoices only.
- Broad runtime instrumentation is limited to explicit runtime counters,
  compact memory counters, and persisted job records.
- Clean-browser SES lockdown console messages are external unless Playwright
  reproduces them from the app origin; only app-origin startup failures become
  lkjstr Log records.
- Home follow discovery and Notifications relay cursors are now bounded and
  deterministic: missing-follow decisions use follow-sub EOSE ownership, and
  Notifications older paging is gated by scroll-owner intent or explicit retry.
- RSS remains diagnostic-only for memory verification; app JavaScript heap is
  the owned browser memory assertion.

## Canonical Docs

- [product/README.md](product/README.md): user-facing behavior.
- [protocol/README.md](protocol/README.md): protocol contracts.
- [architecture/README.md](architecture/README.md): runtime and data ownership.
- [architecture/rust-wasm/README.md](architecture/rust-wasm/README.md):
  Rust/WASM target ownership.
- [architecture/backend/README.md](architecture/backend/README.md):
  browser-local backend contract.
- [architecture/data/feed-surface/README.md](architecture/data/feed-surface/README.md):
  shared feed list contracts.
- [architecture/data/cache-first-feed-pages.md](architecture/data/cache-first-feed-pages.md):
  cache-first feed page proof rules.
- [architecture/data/heap-retention.md](architecture/data/heap-retention.md):
  memory retention symptoms and investigation.
- [architecture/data/resource-ownership.md](architecture/data/resource-ownership.md):
  resource ownership table.
- [architecture/data/storage/README.md](architecture/data/storage/README.md):
  browser storage kernel and retention contract.
- [operations/verification.md](operations/verification.md): verification gate.
- [operations/memory-verification.md](operations/memory-verification.md): memory
  verification workflow.
- [repository/documentation-standards.md](repository/documentation-standards.md):
  documentation and repository rules.

## Verification Gate

Docker Compose is the final verification path: validate Compose config, build
`app`, `verify`, `e2e`, `cloudflare`, and `app-smoke`, then run `verify`,
`e2e`, `cloudflare`, and `app-smoke` services from those images.
