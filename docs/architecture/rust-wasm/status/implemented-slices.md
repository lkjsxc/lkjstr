# Implemented Rust Slices

## Purpose

Implemented rust slice ownership.

## Details

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
  visual fragment, anchor bridge calls, follow-graph parsing bridge calls, and
  cache-backed Home, Global, Notifications, Profile, and Thread feed hosts.
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
  builders, Thread feed view-model/query composition, and Custom Request
  parsing, mode classification, and run planning.
- `lkjstr-ui` renders the partial Leptos workspace shell, Welcome, New Tab,
  Stats inventory and SQLite health, Settings, Accounts, Relay Settings, Upload
  Settings, lkjstr Log durable rows, Tweet draft surfaces, and partial
  Home/Global/Notifications/Profile/Thread feed and Custom Request surfaces.
