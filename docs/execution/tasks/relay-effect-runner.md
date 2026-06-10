# Relay Effect Runner

## Purpose

Wire pure relay reducer effects to browser WebSocket, timer, diagnostic, and
NIP-11 host actions without moving relay correctness into `lkjstr-web`.

## Status

Open after the active storage slice has enough proof for relay diagnostics and
route-evidence dependencies.

## Current Evidence

- `lkjstr-relays` owns pure queues, budgets, leases, route groups, ingress, and
  progressive snapshots.
- `lkjstr-web/src/relay_host/**` owns socket and timeout foundations.

## Next Edit

1. Start only after storage command coverage is stable enough for diagnostics,
   route evidence, optimizer rows, and Stats paths.
2. Map reducer effects to host handles without moving relay correctness into
   `lkjstr-web`.
3. Prove final-close tombstones reject late host events before product wiring.

## Next Checklist

- [ ] Read relay runtime, relay wiring, and relay host source before editing.
- [ ] Update relay wiring docs if effect shapes or cleanup ownership change.
- [ ] Add or split host runner modules under line limits.
- [ ] Add effect-to-host, timer, socket, NIP-11, owner cleanup, and late-event
  tests.
- [ ] Keep TypeScript relay paths until product demand wiring and no-import
  proof exist.
- [ ] Run relay, web relay host, browser host, and Rust/WASM gates; then record
  actual verification.

## Acceptance

A host runner maps reducer effects to open socket, send frame, close socket,
schedule timeout, clear timeout, fetch NIP-11, emit diagnostic, and feed parsed
host events back to reducers. Owner cleanup rejects late events.

## Files To Read

- `docs/architecture/rust-wasm/relay-runtime.md`.
- `docs/architecture/rust-wasm/cutover/relay-wiring.md`.
- `crates/lkjstr-relays/**`.
- `crates/lkjstr-web/src/relay_host/**`.

## Docs To Update First

- `docs/architecture/rust-wasm/cutover/relay-wiring.md`.
- `docs/execution/current-blockers.md` when scope changes.
- Verification ledger after checks run.

## Files To Touch

- `crates/lkjstr-web/src/relay_host/effect_runner.rs`.
- Split existing relay host files before exceeding line caps.

## Temporary TypeScript Or Svelte Files To Keep

Keep `src/lib/relays/**` until Rust relay product wiring and no-import proof
exist.

## Tests To Add Or Update

- Effect-to-host action mapping.
- Owner cleanup and late event tombstones.
- Synthetic relay socket and timeout behavior.

## Focused Gate

```sh
cargo test -p lkjstr-relays
cargo test -p lkjstr-web relay_host
wasm-pack test --headless --chrome crates/lkjstr-web -- relay_socket
```

## Final Gate

Run Docker Compose final gate before relay parity or deletion claims.

## Commit Boundary

Keep reducer changes separate from host adapter wiring unless a test requires
both.

## Must Not

- Do not decide feed completeness in `lkjstr-web`.
- Do not trust disabled or removed relays.
