# Relay Effect Runner

## Purpose

Wire pure relay reducer effects to browser WebSocket, timer, diagnostic, and
NIP-11 host actions without moving relay correctness into `lkjstr-web`.

## Status

Implemented enabling proof. Product relay parity remains partial until shipped
surface demand wiring consumes the host runner and no-import proof exists.

## Current Evidence

- `lkjstr-relays` owns pure queues, budgets, leases, route groups, ingress, and
  progressive snapshots.
- `lkjstr-web/src/relay_host/**` owns socket, timeout, and effect-runner host
  foundations.

## Next Edit

1. Feed shared runtime demand into the host runner without deleting TypeScript
   relay paths.
2. Keep relay correctness in `lkjstr-relays`; `lkjstr-web` remains the browser
   effect boundary.
3. Preserve owner-generation rejection while product surfaces start consuming
   Rust relay snapshots.

## Next Checklist

- [x] Read relay runtime, relay wiring, and relay host source before editing.
- [x] Update relay wiring docs if effect shapes or cleanup ownership change.
- [x] Add or split host runner modules under line limits.
- [x] Add effect-to-host, timer, socket, NIP-11, owner cleanup, and late-event
      tests.
- [x] Keep TypeScript relay paths until product demand wiring and no-import
      proof exist.
- [x] Run relay, web relay host, browser host, and Rust/WASM gates; then record
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

- `crates/lkjstr-web/src/relay_host/effect_action.rs`.
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
wasm-pack test --node crates/lkjstr-web -- relay_effect_runner
wasm-pack test --headless --chrome crates/lkjstr-web -- relay_socket
wasm-pack test --headless --chrome crates/lkjstr-web -- browser_timeout
wasm-pack test --headless --firefox crates/lkjstr-web -- relay_socket
wasm-pack test --headless --firefox crates/lkjstr-web -- browser_timeout
pnpm rust-wasm:quiet
```

Use a matching `--chromedriver` path when multiple cached ChromeDrivers exist;
the quiet wrapper selects the matching driver automatically.

## Final Gate

Run Docker Compose final gate before relay parity or deletion claims.

## Commit Boundary

Keep reducer changes separate from host adapter wiring unless a test requires
both.

## Must Not

- Do not decide feed completeness in `lkjstr-web`.
- Do not trust disabled or removed relays.
