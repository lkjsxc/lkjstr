# Build Contract

## Purpose

This file defines when the app build changes from the current SvelteKit product
runtime to the Rust/WASM product runtime.

## Current Build

`app` currently builds and serves the implemented SvelteKit workspace. Rust/WASM
checks are required for the active Rust crates, protocol bridge, Leptos shell,
storage adapters, and host adapters that already exist.

## Cutover Rule

Use Trunk and Rust as the app build only when the Rust shell satisfies the
current root workspace contract:

- `/` opens the tiled workspace app directly.
- clean startup focuses Welcome and opens Accounts, Relay Settings, Home,
  Notifications, and Tweet.
- every New Tab choice opens a real Rust surface or an honest unavailable state
  backed by a documented open implementation gap.
- storage failure recovers to a usable Welcome workspace.
- workspace mutations persist when IndexedDB is available.
- no product surface uses fake relay data, fake protocol results, or placeholder
  success states.

## Verification

Before cutover, Rust/WASM verification proves the active Rust slices while
SvelteKit verification proves the shipped product. After cutover, the same
Compose service names remain and `app` serves the Trunk artifact.

Required service names stay stable:

- `app`
- `verify`
- `e2e`
- `cloudflare`
- `app-smoke`

Docker services build images from `Dockerfile` and do not mount the source
tree.
