# Shared Feed View Model

## Purpose

Define the pure Rust row view model shared by Home, Global, Profile, Thread,
Notifications, Search lists, Author Context, and User Timeline.

## Current Evidence

- Rust has feed reducers, geometry, fragments, anchors, LOD, and cache evidence
  pieces.
- Shipped feed surfaces still render through TypeScript and Svelte runtimes.

## Target Behavior

Rows use stable ids and real data only: event rows, profile rows, notification
rows, explicit unavailable rows, diagnostics, and footers. Components do not
parse Nostr events.

## Files To Read

- `docs/architecture/rust-wasm/cutover/feed-runtime.md`.
- `docs/architecture/data/feed-surface/README.md`.
- `crates/lkjstr-app/src/feed/**`.
- `crates/lkjstr-storage/src/feed_cache.rs`.

## Docs To Update First

- Feed runtime cutover contract.
- Feed-surface data contract.
- Parity and verification ledgers after proof exists.

## Rust Files To Touch

- `crates/lkjstr-app/src/feed/view_model/**`.
- `crates/lkjstr-ui` only after pure view-model tests exist.

## Temporary TypeScript Or Svelte Files To Keep

Keep feed-surface, timeline, profile, thread, and notification TypeScript and
Svelte paths until Leptos parity and no-import proof exist.

## Tests To Add Or Update

- Stable row id construction.
- Event, unavailable, diagnostic, and footer rows.
- No placeholder rows outside tests.

## Focused Gate

```sh
cargo test -p lkjstr-app feed view_model
cargo test -p lkjstr-protocol
```

## Final Gate

Run Docker Compose final gate before feed-surface parity claims.

## Commit Boundary

View-model data types and pure tests should land before UI rendering.

## Must Not

- Do not parse raw events in components.
- Do not synthesize success rows or mock protocol data.
