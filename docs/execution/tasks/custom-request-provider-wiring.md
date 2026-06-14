# Custom Request Provider Wiring

## Purpose

Move Custom Request execution planning into Rust without replacing the shipped
TypeScript runner before real relay output and deletion proof exist.

## Status

Rust owns parsing, app policy clamps, mode classification, and a narrow run
planner that emits typed query demand only for valid input with relay targets.
The planner derives those targets through the shared query route planner so
disabled or invalid relay URLs do not produce a ready demand.
The shipped Svelte/TypeScript Custom Request tab remains the product owner for
real relay reads and result rendering.

## Current Evidence

- `crates/lkjstr-app/src/custom_request/**` parses supported JSON shapes, clamps
  limits, normalizes explicit relays, classifies exact versus adaptive mode, and
  plans typed demand.
- `crates/lkjstr-app/src/feed/tool_inputs.rs` builds Custom Request query demand
  from parsed requests.
- `src/lib/custom-request/**` remains the shipped relay runner and result
  renderer until Rust host/UI parity exists.

## Next Edit

Wire the Rust run plan to a host provider that can bind selected relays to real
relay effects and render explicit invalid/no-relay states in Leptos without
claiming result parity.

## Files To Read

- `docs/product/tools/custom-request.md`
- `docs/architecture/feeds/runtime/feed-surface-inputs.md`
- `docs/architecture/network/request-budget/intent.md`
- `crates/lkjstr-app/src/custom_request/**`
- `crates/lkjstr-app/src/feed/tool_inputs.rs`
- `src/lib/custom-request/**`
- `src/lib/tabs/custom-request/CustomRequestTab.svelte`

## Files To Touch

- `crates/lkjstr-app/src/custom_request/**`
- `crates/lkjstr-app/tests/custom_request*_test.rs`
- `docs/architecture/rust-wasm/cutover/implementation-ledger.md`
- `docs/architecture/rust-wasm/cutover/parity-ledger.md`
- `docs/architecture/rust-wasm/cutover/verification-ledger.md`

## Focused Gate

```sh
PATH=/home/lkjsxc/.cargo/bin:$PATH cargo test -p lkjstr-app -- custom_request
PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm test -- tests/unit/custom-request
PATH=/home/lkjsxc/.cargo/bin:$PATH pnpm rust-wasm:quiet
```

## Acceptance

- Invalid JSON or invalid request shapes return typed local errors and no relay
  demand.
- Valid requests with no explicit or selected relays return an explicit no-relay
  state and no relay demand.
- Disabled or invalid relay targets return no relay demand.
- Explicit request relays override selected read relays.
- Exact and adaptive modes are preserved from the Rust classifier.
- TypeScript/Svelte Custom Request paths remain until Rust relay output,
  cancellation, UI parity, no-import proof, and final gates exist.

## Must Not

- Do not send invalid input to relays.
- Do not synthesize relay results or success UI.
- Do not delete `src/lib/custom-request` or the Svelte tab from a partial proof.
