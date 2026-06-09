# Build Contract

## Purpose

This file defines when the app build changes from the current SvelteKit product
runtime to the Rust/WASM product runtime.

## Current Build

`app` currently builds and serves the implemented SvelteKit workspace. Rust/WASM
checks are required for the active Rust crates, protocol bridge, Leptos shell,
storage adapters, and host adapters that already exist.

## Build States

1. Current: SvelteKit shell plus growing Rust/WASM islands.
2. Transition: SvelteKit hosts while product surfaces move to Rust/Leptos and
   TypeScript product modules are deleted only after no-import proof.
3. Final: Rust/Leptos static browser app is the root artifact served by
   Cloudflare Workers Static Assets. An optional Rust Worker may handle static
   routing, SPA fallback, headers, and diagnostics only.

## Cutover Rule

Use Trunk and Rust as the app build only when the Rust shell satisfies the
current root workspace contract:

- `/` opens the tiled workspace app directly.
- clean startup focuses Welcome and opens Accounts, Relay Settings, Home,
  Notifications, and Tweet.
- every New Tab choice opens a real Rust surface.
- storage failure recovers to a usable Welcome workspace.
- workspace mutations persist when IndexedDB is available.
- no product surface uses fake relay data, fake protocol results, or placeholder
  success states.

Unavailable states are allowed only for real runtime failures such as relay,
storage, extension, or upload-service failure. They cannot stand in for an
unimplemented Rust product surface at cutover.

## Verification

Before cutover, Rust/WASM verification proves the active Rust slices while
SvelteKit verification proves the shipped product. After cutover, the same
Compose service names remain and `app` serves the Trunk artifact.

Required service names stay stable:

- `app`
- `verify`
- `cloudflare`
- `app-smoke`

Docker services build images from `Dockerfile` and do not mount the source
tree.

Read next: [root-build.md](root-build.md).
