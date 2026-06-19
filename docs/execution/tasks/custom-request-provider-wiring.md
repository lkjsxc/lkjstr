# Custom Request Provider Wiring

## Purpose

Move Custom Request execution into Rust while retaining the old TypeScript
runner until no-import proof and deletion proof exist.

## Status

Rust owns parsing, app policy clamps, mode classification, and a narrow run
planner that emits typed query demand only for valid input with relay targets.
The planner derives those targets through the shared query route planner so
disabled or invalid relay URLs do not produce a ready demand. Leptos now renders
planning states through a host provider that reads selected relays from the
worker-owned relay settings. The Rust body now exposes an in-flight cancel
control while the planned relay window is nonterminal, releases the provider
lease, and renders an explicit canceled state.
`lkjstr-app` now builds Custom Request result view models from real shared feed
windows and explicit state rows. Leptos renders those shared rows. The host
provider now starts a typed relay read for ready plans, maps progressive relay
snapshots into app-owned feed rows, and cancels socket/timer ownership through
the provider lease. Missing providers render an explicit unavailable state
instead of a pending or success placeholder. Node WASM relay probes cover routed request filters, event
matching, complete snapshot rows, failed-empty partial state, and Chrome proof
covers request/run-state restore, app-policy and NIP-11 effective-filter
diagnostics, plus real relay event rows. The shipped Svelte workspace now
mounts the Rust Custom Request tab as a WASM island with typed request/run-state
snapshot callbacks. The old Svelte/TypeScript runner remains retained until
no-import proof and deletion gates exist.

## Current Evidence

- `crates/lkjstr-app/src/custom_request/**` parses supported JSON shapes, clamps
  limits, normalizes explicit relays, classifies exact versus adaptive mode, and
  plans typed demand.
- `crates/lkjstr-app/src/feed/tool_inputs.rs` builds Custom Request query demand
  from parsed requests.
- `crates/lkjstr-app/src/custom_request_feed/**` maps planned demand, real feed
  window rows, and explicit invalid/no-relay/canceled/partial states into the
  shared feed view model, including app-owned diagnostics when app policy or
  NIP-11 relay metadata clamps the effective outbound filter.
- `crates/lkjstr-ui/src/workspace/custom_request*.rs` renders the Rust planning
  form, app-owned feed rows, restored request/run filter fields, canceled
  provider leases, and late-completion suppression.
- `crates/lkjstr-web/src/custom_request_host.rs` reads worker-owned relay
  settings plus stored NIP-11 relay information, calls the Rust app planner,
  starts a typed relay read for ready plans, and cancels that read through
  provider lease release.
- `crates/lkjstr-web/src/custom_request_relay*.rs` routes real WebSocket
  messages through typed relay snapshots before building app-owned feed rows.
- `crates/lkjstr-web/tests/custom_request_relay_test.rs` proves the relay
  filter, match, and snapshot output path in Node WASM without opening sockets.
- `crates/lkjstr-web/tests/custom_request_tab_test.rs` now includes a browser
  WebSocket harness that returns a real event frame plus EOSE and expects the
  Rust Custom Request tab to render that event row. It also proves a raw
  `limit:999` request renders the effective `limit 500` diagnostic from the
  Rust feed model. The focused Chrome wasm-pack proof passes.
- `crates/lkjstr-web/tests/custom_request_nip11_tab_test.rs` seeds stored NIP-11
  relay metadata, expects the Rust tab to render a relay `max_limit`
  diagnostic, and asserts the outbound `REQ` frame uses the clamped limit.
- `crates/lkjstr-web/tests/custom_request_restore_tab_test.rs` mounts a stored
  Rust Custom Request tab snapshot and proves the textarea input plus restored
  run-state status are consumed in the browser.
- `src/lib/components/workspace/custom-request-island.ts` is the shipped host
  bridge and preserves `customRequestInput` plus `customRequestRan` snapshots.
- `src/lib/custom-request/**` remains retained for no-import and deletion proof.

## Next Edit

Extend Custom Request parity toward no-import proof and deletion gates without
moving result synthesis into UI code.

## Files To Read

- `docs/product/tools/custom-request.md`
- `docs/architecture/feeds/runtime/feed-surface-inputs.md`
- `docs/architecture/network/request-budget/intent.md`
- `crates/lkjstr-app/src/custom_request/**`
- `crates/lkjstr-app/src/custom_request_feed/**`
- `crates/lkjstr-app/src/feed/tool_inputs.rs`
- `src/lib/custom-request/**`
- `src/lib/tabs/custom-request/CustomRequestTab.svelte`

## Files To Touch

- `crates/lkjstr-app/src/custom_request/**`
- `crates/lkjstr-app/src/custom_request_feed/**`
- `crates/lkjstr-ui/src/workspace/custom_request*.rs`
- `crates/lkjstr-ui/src/workspace/custom_request_render.rs`
- `crates/lkjstr-web/src/custom_request_host.rs`
- `crates/lkjstr-web/src/custom_request_relay*.rs`
- `crates/lkjstr-web/tests/custom_request*_test.rs`
- `crates/lkjstr-app/tests/custom_request*_test.rs`
- `docs/architecture/rust-wasm/cutover/implementation-ledger.md`
- `docs/architecture/rust-wasm/cutover/parity-ledger.md`
- `docs/architecture/rust-wasm/cutover/verification-ledger.md`

## Focused Gate

```sh
PATH=/home/lkjsxc/.cargo/bin:$PATH cargo test -p lkjstr-app -- custom_request
PATH=/home/lkjsxc/.cargo/bin:$PATH cargo test -p lkjstr-ui custom_request
PATH=/home/lkjsxc/.cargo/bin:$PATH cargo check -p lkjstr-web --target wasm32-unknown-unknown
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --node crates/lkjstr-web --test custom_request_relay_test
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome crates/lkjstr-web --test custom_request_tab_test
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome crates/lkjstr-web --test custom_request_nip11_tab_test
PATH=/home/lkjsxc/.cargo/bin:$PATH wasm-pack test --headless --chrome crates/lkjstr-web --test custom_request_restore_tab_test
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
- The Rust tab persists request JSON and run-state filter fields for restore.
- Ready state means routed relay demand is planned; it does not claim events
  were fetched or matched.
- Rust result rows must come from the shared feed window and render explicit
  invalid, no-relay, canceled, loading, partial, empty, or terminal states.
- Real Rust relay output must use typed WebSocket host effects, reducer snapshots,
  and lease cleanup; the UI/provider layer must not synthesize result rows.
- TypeScript/Svelte Custom Request paths remain until no-import proof, deletion
  proof, and final gates exist.

## Must Not

- Do not send invalid input to relays.
- Do not synthesize relay results or success UI.
- Do not delete `src/lib/custom-request` or the Svelte tab from a partial proof.
