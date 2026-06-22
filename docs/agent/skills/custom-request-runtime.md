# Skill: Custom Request Runtime

## Purpose

Move Custom Request parsing, planning, relay execution, result rows, snapshots,
and deletion proof into Rust/WASM without weakening input truth or relay output.

## Trigger

Use when editing Custom Request filters, selected-relay execution, result rows,
run snapshots, cancellation, or retained Custom Request TypeScript paths.

## Read First

- [../../product/tools/custom-request.md](../../product/tools/custom-request.md).
- [../../architecture/runtimes/query-runtime.md](../../architecture/runtimes/query-runtime.md).
- [../../architecture/rust-wasm/cutover/parity-ledger.md](../../architecture/rust-wasm/cutover/parity-ledger.md).
- [../../architecture/rust-wasm/cutover/deletion-ledger.md](../../architecture/rust-wasm/cutover/deletion-ledger.md).
- [../../execution/tasks/custom-request-provider-wiring.md](../../execution/tasks/custom-request-provider-wiring.md).

## Files Likely Touched

- `crates/lkjstr-app/src/custom_request/`.
- `crates/lkjstr-ui/src/workspace/custom_request*`.
- `crates/lkjstr-web/src/custom_request*` and browser tests.
- `src/lib/custom-request/`, `src/lib/tabs/custom-request/`, and tests.

## Procedure

1. Update docs before source when behavior changes.
2. Keep parse errors exact and visible.
3. Clamp filters and relay counts through Rust app policy and relay limits.
4. Release replaced or provider-unavailable leases before dispatch.
5. Preserve request and run snapshots through typed callbacks.

## Focused Gate

```sh
pnpm test -- tests/unit/custom-request
cargo test -p lkjstr-app custom_request
cargo test -p lkjstr-relays
pnpm verify:quiet
```

## Final Gate

Run Docker final gate before deletion or broad Custom Request parity claims.

## Must Not

- Do not send malformed or unclamped filters.
- Do not invent relay output, success, or failure rows.
- Do not render action buttons without a real handler.

## Handoff

List filter proof, relay-output proof, cancellation proof, snapshot proof,
no-import commands, and remaining retained paths.
