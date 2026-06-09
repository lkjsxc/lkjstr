# Relay Effect Runner

## Purpose

Wire pure relay reducer effects to browser WebSocket, timer, diagnostic, and
NIP-11 host actions without moving relay correctness into `lkjstr-web`.

## Current Evidence

- `lkjstr-relays` owns pure queues, budgets, leases, route groups, ingress, and
  progressive snapshots.
- `lkjstr-web/src/relay_host/**` owns socket and timeout foundations.

## Target Behavior

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

## Rust Files To Touch

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
