# FEED-001 Shared Feed Runtime Gap Closure

## Purpose

Close remaining shared feed runtime parity gaps without deleting retained paths prematurely.

## Status

active

## Current Evidence

- current blocker says shared feed runtime is the first incomplete blocker.
- Public Chat now has Rust shared demand-surface planning for channel discovery,
  metadata, selected-channel messages, and own moderation reads.
- TypeScript orchestration also names `public-chat`, filters live ingress to
  NIP-28 Public Chat event kinds, and preserves exact read purposes.
- EventTreeList near-end detection now uses a tested observer-owner factory with
  idempotent `observe` and `disconnect`, callback in-flight dedupe, and disabled
  or missing-element no-op behavior.

## Next Edit

Continue wiring retained feed-like runtimes through shared demand, coverage,
and provider paths before deletion proof.

## Files To Read

- docs/execution/blockers/shared-feed-runtime.md
- docs/agent/skills/feed-runtime.md
- docs/architecture/rust-wasm/cutover/feed-runtime.md

## Files To Touch

- crates/lkjstr-app/src/feed/\*\*
- crates/lkjstr-ui/\*\*
- src/lib/feed-surface/\*\*
- tests/unit/feed-surface/\*\*

## Focused Gate

```sh
cargo test -p lkjstr-app -- feed
pnpm test -- tests/unit/feed-surface
pnpm rust-wasm:quiet
```

## Acceptance

The edited gap has focused proof and blocker/ledger notes name remaining gaps.

## Must Not

- Do not claim feed-surface deletion.
- Do not treat missing coverage as absence.
