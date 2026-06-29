# Current State

## Purpose

This file is the concise implemented-state entry for lkjstr. Detailed state is
split by ownership under [current-state/README.md](current-state/README.md).

## Summary

- The root route opens the tiled browser workspace and is explicitly
  client-rendered so Cloudflare Workers do not evaluate browser-only workspace
  modules while serving `/`.
- Shipped product runtime remains SvelteKit and TypeScript under `src/` while
  Rust/WASM crates take ownership slice by slice with proof.
- Durable product storage is worker-owned SQLite OPFS with an origin-level
  owner lease for persistent dedicated workers and explicit busy, unsupported,
  or temporary states when persistence cannot open.
- Product modules use typed repositories; main-thread product code must not
  open SQLite, OPFS, IndexedDB, localStorage, Cache Storage, or quota APIs
  directly unless the file is an approved host adapter or diagnostic owner.
- Relay, storage, signer, upload, privacy, and browser feature states render
  real data or explicit loading, unavailable, unsupported, denied, partial,
  consent-required, or proven-empty states. No fake product data or placeholder
  success state is allowed.
- Home, Global, Profile, Thread, Notifications, Search, Custom Request, Author
  Context, Followees, and User Timeline have active Rust island or Rust-backed
  slices, but retained TypeScript and Svelte code may be deleted only after
  parity, focused tests, ledger evidence, and no-import proof.
- Rust/WASM build tools are verification dependencies, not browser runtime
  dependencies. Missing local development WASM assets render explicit
  bridge-unavailable states rather than raw Node or toolchain errors. Production
  builds must prove the bridge artifacts, manifest-tracked bridge imports,
  manifest cache headers, local Worker root response, and hosted bridge bytes
  before deployment is considered safe.

## Detail Map

- [current-state/product-surfaces.md](current-state/product-surfaces.md): shipped product surfaces.
- [current-state/protocol-support.md](current-state/protocol-support.md): protocol support and relay rules.
- [current-state/storage-state.md](current-state/storage-state.md): storage ownership and SQLite worker state.
- [current-state/workspace-feeds.md](current-state/workspace-feeds.md): workspace and feed state.
- [current-state/network-runtimes.md](current-state/network-runtimes.md): relay runtimes and diagnostics.
- [current-state/memory-retention.md](current-state/memory-retention.md): memory and retention contracts.
- [current-state/open-contracts.md](current-state/open-contracts.md): open contracts and out-of-scope boundaries.
- [current-state/canonical-docs.md](current-state/canonical-docs.md): canonical docs for deeper reading.

## Agent Routing

Agents start here, then read [agent/README.md](agent/README.md),
[execution/current-blockers.md](execution/current-blockers.md), and the
contracts linked by the chosen task.
