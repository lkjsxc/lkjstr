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
  map, typed operation outcomes, tab-state keys, ledger rows, and Rust
  workspace records.
- `lkjstr-web` owns narrow IndexedDB adapters for workspace startup, workspace
  rows, settings rows, account rows, relay sets, Tweet drafts, and early host
  calls needed by the partial Leptos shell.
- `lkjstr-relays` owns pure send queue, request scheduler, subscription id,
  subscription alias, close tombstone, and outbound `REQ` message-size budget
  state machines.
- `lkjstr-app` owns startup recovery and bounded warm tab snapshot staging.
- `lkjstr-ui` renders the partial Leptos workspace shell, Welcome, New Tab,
  Stats inventory, Settings, Accounts, Relay Settings, Upload Settings, and
  Tweet draft surfaces.

## Open Foundations

- Full relay client reducer, request budget reducer, progressive snapshots,
  diagnostics merge, page read dedupe, demand planning, and lease planning.
- Browser WebSocket and timer adapters with owned callbacks and cleanup.
- Full storage transaction abstraction, request deadlines, multi-store
  repository writes, retention dispatchers, repair, and inventory diagnostics.
- Feed runtimes for Home, Global, Profile, Thread, Notifications, Search,
  Custom Request, and Author Context.
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
3. Finish storage transaction and deadline foundations.
4. Finish relay reducer, browser adapters, and subscription orchestration.
5. Wire feed runtimes and then delete replaced TypeScript or Svelte modules.
