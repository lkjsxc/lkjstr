# Surface Cutover Order

## Purpose

This file ranks Rust/WASM product cutover work by dependency value. Use it with
[status.md](status.md), [cutover/parity-ledger.md](cutover/parity-ledger.md),
and [cutover/deletion-ledger.md](cutover/deletion-ledger.md) before changing a
surface.

## Ordering Rule

Build shared product foundations before individual tabs. A surface moves only
when Rust owns real storage, relay, protocol, and UI behavior with tests. Do not
open a Leptos tab that claims success from placeholder data.

## Ranked Work

1. Storage repository wiring for startup, protected records, Stats, feeds,
   diagnostics, jobs, log rows, retention, and recovery.
2. Relay runtime wiring for WebSocket host adapters, timers, request budgets,
   page-read dedupe, progressive snapshots, and cleanup.
3. Shared feed runtime foundation for cache proof, route planning, row view
   models, geometry, anchors, footer phases, and unavailable states.
4. Home.
5. Global.
6. Profile.
7. Thread.
8. Notifications.
9. Search.
10. Custom Request.
11. Tweet publish.
12. Profile Edit.
13. Public Chat.
14. Mine npub.
15. lkjstr Log.
16. Author Context.
17. Followees and User Timeline Leptos parity.
18. Root build cutover to the Rust/WASM app artifact.

## Per-Surface Checklist

Each surface cutover document or ledger row names:

- user-visible behavior owned by Rust.
- Rust source paths touched.
- TypeScript or Svelte paths replaced.
- storage data families read or written.
- relay route rules and budgets.
- focused tests.
- Docker final gate status.
- deletion proof and no-import proof when code is removed.

## Blocking Rule

A lower-ranked surface may receive pure reducers, parsers, or test fixtures, but
it must not replace shipped product ownership until all higher shared
foundations it depends on are real and verified.
