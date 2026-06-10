# Shared Feed View Model

## Purpose

Define the pure Rust row view model shared by Home, Global, Profile, Thread,
Notifications, Search lists, Author Context, and User Timeline.

## Status

Open after storage proof and relay effect wiring can supply real cache evidence
and progressive snapshots.

## Current Evidence

- Rust has feed reducers, geometry, fragments, anchors, LOD, and cache evidence
  pieces.
- Shipped feed surfaces still render through TypeScript and Svelte runtimes.

## Next Edit

1. Start after storage command coverage and relay effect wiring can provide real
   cache proof and progressive snapshots.
2. Define shared row data before any Home-specific rendering.
3. Keep every row backed by real events, real profile state, diagnostics, or an
   explicit unavailable state.

## Next Checklist

- [ ] Read feed runtime, feed-surface, app feed, storage cache, and relay page
      contracts.
- [ ] Update feed runtime docs before changing row or footer semantics.
- [ ] Add stable row-id and feed row view-model data types in `lkjstr-app`.
- [ ] Add conversions from cache/protocol render plans and unavailable states.
- [ ] Add pure tests for row ids, duplicate merge, unavailable, diagnostic,
      footer, and no-placeholder states.
- [ ] Run app feed view-model and protocol tests; then record actual
      verification.

## Acceptance

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

## Files To Touch

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
