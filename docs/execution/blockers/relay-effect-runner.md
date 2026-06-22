# Relay effect runner (implemented host mapping proof)

## Purpose

Implemented relay effect runner blocker details.

## Details

Wire Rust relay effects to browser WebSocket, timers, NIP-11 fetch, budgets,
page-read cleanup, and progressive snapshots.

- Cutover-ledger row: [Relay runtime](../../architecture/rust-wasm/cutover/implementation-ledger.md).
- Docs to read: [network README](../../architecture/network/README.md),
  [relay runtime](../../architecture/rust-wasm/relay-runtime.md),
  [relay pool](../../architecture/network/relay-pool.md),
  [relay routing](../../architecture/network/relay-routing.md),
  [request budget](../../architecture/network/request-budget/README.md), and
  [subscription orchestration](../../architecture/network/subscription-orchestration/README.md).
- Crates: `lkjstr-relays`, `lkjstr-web`, and `lkjstr-app`.
- Shipped source paths: `crates/lkjstr-relays/`,
  `crates/lkjstr-web/src/relay*`, `src/lib/relays/`,
  `tests/unit/relays/`, `tests/unit/events/relay-page-scan.test.ts`, and
  `tests/unit/events/relay-page-adaptive-window.test.ts`.
- Focused tests: `cargo test -p lkjstr-relays`,
  `cargo test -p lkjstr-web`,
  `pnpm test -- tests/unit/events/relay-page-scan.test.ts tests/unit/events/relay-page-adaptive-window.test.ts`,
  and `pnpm rust-wasm:quiet`.
- Completed proof: `lkjstr-web` maps relay reducer effects to typed socket,
  frame, timer, NIP-11, diagnostic, snapshot, and callback-owner host actions.
  Typed host events feed reducer events only while the owner generation is
  active; closed owners emit ignored-after-close diagnostics and replaced
  generations are rejected. Firefox socket and timer host tests plus
  Rust/WASM quiet passed. The transitional TypeScript orchestrator closes live
  wires when a visible owner releases and only hidden owners remain, without
  no-op release sentinels. Product surfaces still consume TypeScript relay
  runtime paths until shared feed demand wiring and no-import proof exist.
