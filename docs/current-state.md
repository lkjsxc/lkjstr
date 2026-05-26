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

## Ownership

- Workspace layout, tabs, settings, accounts, drafts, notifications, relay
  information, relay summaries, jobs, and cached events are browser-owned data.
- Pointer tab dragging is canonical. Native desktop drag uses pane-body edge
  detection for splits and tab-strip center insert for reorder. Half-pane edge
  previews cover the body only.
- Tab rails scroll horizontally with long-press touch drag, strip-priority
  reorder, and active-tab reveal.
- Durable event cache has no application item-count ceiling. Optional
  quota-pressure compaction may run when browser storage is near its limit.
  Runtime feed windows remain bounded per tab.
- Shared storage normalizes events, relay receipts, tag rows, cursors, and jobs
  before runtime use.
- Relay ingress uses app-owned byte and structure caps before expensive JSON
  and event parsing.
- IndexedDB remains durable browser-owned data; memory relief prunes only
  bounded app-owned runtime windows, caches, counters, and fallback stores.
- Relay clients, relay pool, subscription manager, and tab runtimes own network
  reads and deterministic cleanup.
- Inactive workspace tabs unmount immediately. Session snapshots and IndexedDB
  `tabStates` restore scroll anchors and feed cursors when tabs return or after
  reload.
- Feed surfaces share near-end prefetch, `FeedSurfaceStatus`, speculative older
  pages, and virtual lists on Home, Global, Profile notes, Thread, Search, and
  Custom Request.
- Event rows show nip05-only subtitles on feeds, pressed Heart/Repost styling
  from real local action evidence, and no left-side new-event stripe.
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
- RSS remains diagnostic-only for memory verification; app JavaScript heap is
  the owned browser memory assertion.

## Canonical Docs

- [product/README.md](product/README.md): user-facing behavior.
- [protocol/README.md](protocol/README.md): protocol contracts.
- [architecture/README.md](architecture/README.md): runtime and data ownership.
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
