# Rust WASM Status

## Purpose

This file is the concise status map for the active Rust/WASM migration.

## Implemented Rust Slices

- `lkjstr-protocol` owns byte codecs, event parsing, frame policy checks,
  canonical event serialization, event ID hashing, filter matching, relay
  message basics, Schnorr verification, local signing, relay URL
  normalization, NIP-19 entities, NIP-30 helpers, NIP-36 warnings, tag
  indexing, reactions, action tags, NIP-51 emoji source helpers, NIP-57 zaps,
  NIP-65 relay-list metadata, NIP-96 upload metadata, and NIP-98 auth helpers.
- `lkjstr-domain` owns account records, relay-set reducers, Tweet draft models,
  workspace layout reducers, tab movement, edge splits, clean startup,
  recovery, New Tab catalog data, and tab snapshot payload contracts.
- `lkjstr-storage` owns the executable table manifest, cache-ledger resource
  map, typed operation outcomes, executable SQLite schema records, protected,
  event-cache, diagnostics, and optimizer statements, schema hash, tab-state
  keys, ledger rows, and protected plus cache SQLite row codecs.
- `lkjstr-web` owns narrow IndexedDB adapters for workspace startup, workspace
  rows, settings rows, account rows, local secrets, relay sets, Tweet drafts,
  the first multi-store transaction helper, ledger-backed tab-state snapshot
  writes, startup tab-state loading, a typed SQLite storage-worker adapter with
  deadlines, cancellation, close cleanup, late diagnostics, protected, core
  event-cache, diagnostics SQLite repository calls, SQLite table-count
  inventory over the worker, relay WebSocket and browser timeout adapter
  foundations with owned callback cleanup and Rust protocol parsing for text
  relay frames, and early host calls needed by the partial Leptos shell.
- `lkjstr-relays` owns pure send queue, request scheduler, subscription id,
  subscription alias, close tombstone, request budget derivation, outbound
  `REQ` message-size budget, semantic page-read keys, in-flight page-read
  registry state, progressive read snapshots, demand lease fingerprints,
  owner-registry state, route-plan grouping, ingress classification, and relay
  live-lease host-effect reducer state, plus relay client lifecycle and typed
  relay-message reducer state machines.
- `lkjstr-relays` now owns the pure relay read score reducer: stable score keys,
  real read observations, bounded score updates, stale decay, fairness credit,
  and deterministic ordering.
- `lkjstr-app` owns startup recovery, stored tab snapshot filtering, bounded
  warm tab snapshot staging, pure query-demand planning, feed-window reduction,
  adaptive feed-scan planning, feed-scan feedback traces, feed live-runtime
  composition, surface query input builders, and a pure Custom Request parser
  and mode classifier.
- `lkjstr-ui` renders the partial Leptos workspace shell, Welcome, New Tab,
  Stats inventory, Settings, Accounts, Relay Settings, Upload Settings, and
  Tweet draft surfaces.

## Open Foundations

- Product wiring for app query-demand plans, request budgets, page-read dedupe,
  progressive snapshot consumption, diagnostics merge, route-plan discovery
  integration, relay optimizer measurement, and Stats projection.
- Relay adapter product wiring from pure reducers to browser WebSocket and
  timer handles.
- Product SQLite wiring, cache delete and repair paths, retention dispatchers,
  and full ledger and byte inventory diagnostics.
- Product feed runtime wiring for Home, Global, Profile, Thread,
  Notifications, Search, Custom Request, and Author Context. Pure query inputs
  and feed-window reducers exist; shipped surfaces still use TypeScript.
- Publish jobs, local signing flow integration, NIP-07 `signEvent`, media
  upload transport, custom emoji publish support, and Profile Edit publish.
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
5. Wire feed runtimes and then delete replaced TypeScript or Svelte modules.
