# Shared Feed View Model

## Purpose

Define the pure Rust row view model shared by Home, Global, Profile, Thread,
Notifications, Search lists, Author Context, and User Timeline.

## Status

Implemented as an enabling slice. The broader shared feed runtime remains
partial until cache proof and relay snapshots feed a Rust-owned surface.

## Current Evidence

- Rust has feed reducers, geometry, fragments, anchors, LOD, and cache evidence
  pieces.
- `crates/lkjstr-app/src/feed/view_model/**` builds stable typed rows from
  feed-window events, explicit state rows, and footer inputs.
- Focused proof covers event rows, duplicate relay merge, profile and
  notification row ids, unavailable rows, diagnostic rows, verified nested
  repost target rows with declared-target checks, and footer states.
- Shipped feed surfaces still render through TypeScript and Svelte runtimes.

## Next Edit

Wire cache proof and relay snapshots through this row model in the narrow Home
feed slice before any broader feed surface parity claim.

## Next Checklist

- [x] Read feed runtime, feed-surface, app feed, storage cache, and relay page
      contracts.
- [x] Update feed runtime docs before changing row or footer semantics.
- [x] Add stable row-id and feed row view-model data types in `lkjstr-app`.
- [x] Add conversions from feed-window events, event render plans, and explicit
      unavailable states.
- [x] Add pure tests for row ids, duplicate merge, unavailable, diagnostic,
      footer, and no-placeholder states.
- [x] Run app feed view-model and protocol tests; then record actual
      verification.

## Acceptance

Rows use stable ids and real data only: event rows, profile rows, notification
rows, verified repost target rows, explicit unavailable rows, diagnostics, and
footers. Components do not parse Nostr events.

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
/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-app feed_view_model
/home/lkjsxc/.cargo/bin/cargo test -p lkjstr-app feed
cargo test -p lkjstr-protocol
pnpm test -- tests/unit/feed-surface tests/unit/timeline/timeline-reducer.test.ts tests/unit/timeline/timeline-follow-loading.test.ts
PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm rust-wasm:quiet
```

## Final Gate

Run Docker Compose final gate before feed-surface parity claims.

## Commit Boundary

View-model data types and pure tests should land before UI rendering.

## Must Not

- Do not parse raw events in components.
- Do not synthesize success rows or mock protocol data.
