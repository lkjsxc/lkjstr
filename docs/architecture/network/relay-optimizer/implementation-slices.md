# Relay Optimizer Implementation Slices

## Purpose

This file defines the smallest coherent implementation slices for optimizer
work. Each slice must update docs, source, and tests together.

## Slice Order

| Slice | Required change | Focused gate |
| --- | --- | --- |
| Storage rows | Add or change optimizer table, row codec, repository, retention, repair, or inventory behavior | `cargo test -p lkjstr-storage` and scan model repository tests |
| Relay scoring | Change score components, stale decay, fairness, disabled relay exclusion, or score key shape | `cargo test -p lkjstr-relays` and relay read score tests |
| Scan planning | Change span math, model selection, density update, confidence, caps, or trace DTOs | `cargo test -p lkjstr-app -- feed_scan` and `pnpm rust-wasm:quiet` |
| Bridge state | Change WASM loader, DTO mapping, unavailable state, timeout state, or invalid input handling | scan model bridge tests and runtime counter tests |
| Product read path | Wire or change Home, Global, Profile, Notifications, or safe Custom Request reads | relay page scan, profile paging, notification paging, and verify quiet gates |
| Stats projection | Change optimizer rows, storage mode, latest decisions, or unavailable states in Stats | runtime counter, cache status, and verify quiet gates |

## Slice Contract

- Keep selected read relays as correctness fallback.
- Exclude disabled or removed relays before scoring, scan planning, and route
  evidence ordering.
- Use stable semantic keys. Exclude tab ids, pane ids, owner handles, request
  ids, subscription ids, and paging cursors from learned model keys.
- Persist only observations from real relay reads or real cache evidence.
- Keep decision traces bounded and redacted.
- Show explicit unavailable, timeout, memory fallback, storage unavailable, or
  invalid input states instead of creating neutral learned evidence.

## Completion Rule

A slice is complete when the focused gate passes and the relevant row in
[product-wiring-ledger.md](product-wiring-ledger.md),
[stats-projection.md](stats-projection.md), or
[../../../product/doc-impl-audit.md](../../../product/doc-impl-audit.md) records
the actual shipped behavior.
