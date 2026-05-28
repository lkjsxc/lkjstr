# Current State

## Purpose

This document summarizes the implemented state. Detailed contracts live in the
linked product, protocol, architecture, and operations pages.

## Product Surfaces

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

- Implemented Nostr support includes NIP-01, NIP-02, NIP-05, NIP-07, NIP-10,
  NIP-11, NIP-18, NIP-19, NIP-25, NIP-30, NIP-36, NIP-50, NIP-51, NIP-57,
  NIP-65, NIP-96, and NIP-98 surfaces documented in
  [protocol](protocol/README.md).
- Relay AUTH is diagnostic-only.
- Search uses cached matches plus NIP-50 relay filters when selected relays
  support them.
- Home, Global, Search, and Custom Request consume progressive relay read
  snapshots so partial rows can render before final relay coverage.
- Home, Global, and Profile grouped feed scans use an adaptive temporal window
  controller. Scans start at `12` minutes, double adjacent windows when complete
  relay-shaped reads return at most half of the effective limit, halve dense
  windows when any relay-shaped read reaches the effective limit, and keep
  balanced spans unchanged.

## Ownership

- Workspace layout, tabs, settings, accounts, drafts, notifications, relay
  information, relay summaries, jobs, and cached events are browser-owned data.
- Pointer tab dragging is canonical. Native desktop drag uses pane chrome
  exclusion and pane-body edge detection for splits. Center and edge drop
  previews align with the content stack only and never cover the tab strip or
  tile menu row.
- Tab rails scroll horizontally with long-press touch drag, pointer capture,
  selection suppression, strip-priority reorder, and active-tab reveal.
- Durable event cache has no application item-count ceiling. `cache.maxBytes`
  provides a soft byte budget; scheduled compaction may run when storage usage
  exceeds the lower of quota pressure and that setting. Runtime feed windows
  remain bounded.
- Shared storage normalizes events, relay receipts, tag rows, cursors, and jobs
  before runtime use.
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
- Feed route isolation is being tightened so Home and Profile route-group reads
  use resolved route fingerprints, while Notifications and selected-relay tools
  keep independent semantic keys.
- Matching Home tabs attach to one shared query keyed by account, selected
  relays, page size, and feed policy. Tab ids own attachments only.
- Stats and `__lkjstrMemoryDebug()` expose orchestration demand, lease, and
  event intake counters. Stats labels active relay subscriptions by redacted
  human purpose and keeps raw ids secondary.
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
- Home, Global, and Profile initial, older, and newer feed pages use adaptive
  grouped scans. Search, Custom Request, Author Context, Thread reply pages,
  metadata, follow-list, and id-batch lookups keep their exact request shapes.
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
  durable hard-protected priority rows.
- Cleanup ownership for every resource type is documented in
  [resource-ownership.md](architecture/data/resource-ownership.md).
- Heap snapshot collection, memory budgets, and the verification workflow are
  documented in [heap-retention.md](architecture/data/heap-retention.md) and
  [memory-verification.md](operations/memory-verification.md).
- Product polish tracked in [product/backlog.md](product/backlog.md) follows
  memory gate stability.

## Known Gaps

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
- [architecture/backend/README.md](architecture/backend/README.md):
  browser-local backend contract.
- [architecture/data/feed-surface/README.md](architecture/data/feed-surface/README.md):
  shared feed list contracts.
- [architecture/data/heap-retention.md](architecture/data/heap-retention.md):
  memory retention symptoms and investigation.
- [architecture/data/resource-ownership.md](architecture/data/resource-ownership.md):
  resource ownership table.
- [operations/verification.md](operations/verification.md): verification gate.
- [operations/memory-verification.md](operations/memory-verification.md): memory
  verification workflow.
- [repository/documentation-standards.md](repository/documentation-standards.md):
  documentation and repository rules.

## Verification Gate

Docker Compose is the final verification path: validate Compose config, build
`app`, `verify`, `e2e`, and `cloudflare`, then run `verify`, `e2e`, and
`cloudflare` services from those images.
