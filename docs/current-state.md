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
- Pointer tab dragging is the canonical cross-device movement path. Native
  desktop drag uses the same pane drop zones and overlay contract.
- Shared storage normalizes events, relay receipts, tag rows, cursors, and jobs
  before runtime use.
- Relay ingress uses app-owned byte and structure caps before expensive JSON
  and event parsing.
- IndexedDB remains durable browser-owned data; memory relief prunes only
  bounded app-owned runtime windows, caches, counters, and fallback stores.
- Relay clients, relay pool, subscription manager, and tab runtimes own network
  reads and deterministic cleanup.
- Inactive workspace tabs unmount immediately and restore from bounded
  session-memory snapshots when reselected within the configured retention
  window.
- Relay publish waiters, paged read leases, deduped read abort listeners, relay
  client final close state, and idle pool eviction are covered by lifecycle
  cleanup tests.
- Runtime counters use static aggregate keys only, and `check:repo` rejects
  first-party source classes outside the Dexie database binding.
- Search, Custom Request, Author Context, Tweet, event rows, references, event
  lists, and anchored popovers guard async UI continuations after teardown.
- Cloudflare Workers Static Assets is a hosting target only; it does not add a
  backend account service, relay proxy, or Cloudflare storage dependency.

## Known Gaps

- Remote NIP-50 results depend on actual relay support.
- Passkey-protected local secret storage is design-only.
- Encrypted direct messages are not implemented.
- Wallet custody is out of scope; zap support opens or copies invoices only.
- Broad runtime instrumentation is limited to explicit runtime counters,
  compact memory counters, and persisted job records.
- RSS remains diagnostic-only for memory verification; app JavaScript heap is
  the owned browser memory assertion.
- Memory retention investigation is active. See
  [heap-retention.md](architecture/data/heap-retention.md) for symptoms and
  strategy, [resource-ownership.md](architecture/data/resource-ownership.md)
  for cleanup ownership, and
  [memory-verification.md](operations/memory-verification.md) for the
  verification workflow.

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
