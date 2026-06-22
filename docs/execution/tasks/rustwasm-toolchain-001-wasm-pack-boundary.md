# RUSTWASM-TOOLCHAIN-001: Make wasm-pack availability deterministic and non-leaky

## Purpose

Make `wasm-pack` availability a deterministic build/check concern and prevent
raw toolchain errors from leaking into Timeline, feed, Rust island, or diagnostic
product UI.

## Status

completed

## Current Evidence

- The Vite Rust/WASM asset plugin preflights `wasm-pack`; production build
  failure uses actionable diagnostics while dev bridge UI gets product-safe
  unavailable text.
- `pnpm rust-wasm:quiet` and `lkjstr-xtask quiet rust-wasm` preflight
  `wasm-pack`, Chrome, and Firefox, then report the install or Docker path when
  a dependency is missing.
- Timeline/feed Rust island hosts, retained island tabs, feed-surface bridge
  loaders, follow-graph, and Stats diagnostics sanitize raw toolchain messages.
- Docker config, build, verify, Cloudflare dry-run, and app smoke passed with
  pinned image-installed Rust/WASM tools and browsers.

## Next Edit

Continue shared feed runtime parity work now that the `wasm-pack` boundary is
deterministic and non-leaky.

## Files To Read

- docs/architecture/rust-wasm/toolchain-boundary.md
- scripts/vite-lkjstr-web-wasm.ts
- scripts/run-quiet.ts
- crates/lkjstr-xtask/src/quiet_steps.rs
- src/lib/components/workspace/RustIslandHost.svelte

## Files To Touch

- docs/architecture/rust-wasm/\*\*
- docs/operations/verification.md
- docs/current-state.md
- scripts/\*\*
- crates/lkjstr-xtask/src/\*\*
- src/lib/\*\*/wasm or bridge error handling
- tests/unit/\*\*

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
