# RUSTWASM-TOOLCHAIN-001: Make wasm-pack availability deterministic and non-leaky

## Purpose

Make `wasm-pack` availability a deterministic build/check concern and prevent
raw toolchain errors from leaking into Timeline, feed, Rust island, or diagnostic
product UI.

## Status

active

## Current Evidence

- The Vite Rust/WASM asset plugin currently calls `wasm-pack` during dev/build
  asset generation.
- Missing `wasm-pack` can become the virtual bridge error message and reach
  product bridge-unavailable UI as raw `spawnSync wasm-pack ENOENT` text.
- Docker installs pinned `wasm-pack` and Trunk, but local preflight and product
  error mapping are incomplete.

## Next Edit

Add build/check preflight diagnostics, sanitize product bridge-unavailable
messages, and prove Rust/WASM verification still runs when tools are available.

## Files To Read

- docs/architecture/rust-wasm/toolchain-boundary.md
- scripts/vite-lkjstr-web-wasm.ts
- scripts/run-quiet.ts
- crates/lkjstr-xtask/src/quiet_steps.rs
- src/lib/components/workspace/RustIslandHost.svelte

## Files To Touch

- docs/architecture/rust-wasm/**
- docs/operations/verification.md
- docs/current-state.md
- scripts/**
- crates/lkjstr-xtask/src/**
- src/lib/**/wasm or bridge error handling
- tests/unit/**

## Focused Gate

```sh
pnpm test -- tests/unit/rust-wasm tests/unit/workspace tests/unit/feed-surface
cargo test -p lkjstr-xtask toolchain
pnpm rust-wasm:quiet
```

## Acceptance

Missing `wasm-pack` fails build/check commands with an actionable diagnostic,
product runtime renders a non-successful bridge-unavailable state, raw
`spawnSync wasm-pack ENOENT` does not appear in product UI, and Docker proves the
pinned toolchain path.

## Must Not

- Do not skip Rust/WASM checks.
- Do not fake WASM artifacts or bridge success.
- Do not show raw Node or toolchain stack traces in product UI.
- Do not delete retained TypeScript or Svelte product paths.
