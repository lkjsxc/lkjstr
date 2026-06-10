# Skill: Relay Runtime

## Purpose

Change relay behavior: schedulers, subscriptions, request budgets, page
reads, route evidence, NIP-11 metadata, NIP-65 suggestions, ingress caps,
diagnostics, and the Rust relay effect runner.

## Trigger

The change touches `crates/lkjstr-relays`, relay host adapters in
`crates/lkjstr-web`, `src/lib/relays/`, or a contract under
`docs/architecture/network/`.

## Read First

- [../../architecture/network/README.md](../../architecture/network/README.md).
- [../../architecture/rust-wasm/relay-runtime.md](../../architecture/rust-wasm/relay-runtime.md).
- [../../architecture/network/subscription-orchestration/README.md](../../architecture/network/subscription-orchestration/README.md).
- [../../architecture/network/request-budget/README.md](../../architecture/network/request-budget/README.md).
- [../../execution/tasks/relay-effect-runner.md](../../execution/tasks/relay-effect-runner.md)
  when wiring Rust effects to browser hosts.

## Files Likely Touched

- `crates/lkjstr-relays/`: pure reducers, budgets, leases, route plans,
  ingress classification.
- `crates/lkjstr-web/src/relay*`: WebSocket, timer, and NIP-11 fetch hosts.
- `src/lib/relays/`: shipped TypeScript pool and orchestration, retained
  until deletion proof.
- `tests/unit/relays/` and relay paging tests under `tests/unit/events/`.

## Procedure

1. Update the network contract before source.
2. Keep relay decisions in pure reducers; browser WebSocket, timer, and fetch
   effects stay behind owned host adapters with explicit cleanup.
3. Apply byte and structure ingress caps before expensive JSON or event
   parsing.
4. Keep partial relay failure diagnostic: reachable relays keep serving, and
   failures show real reasons.
5. Prove cancellation and cleanup: closed owners abort queued page reads and
   release leases.

## Focused Gate

```sh
cargo test -p lkjstr-relays
cargo test -p lkjstr-web
pnpm test -- tests/unit/relays
pnpm test -- tests/unit/events/relay-page-scan.test.ts tests/unit/events/relay-page-adaptive-window.test.ts
pnpm rust-wasm:quiet
```

Use the Relay Hardening, Relay Paging, and Subscription Orchestration gates
in [../../operations/focused-gates.md](../../operations/focused-gates.md)
when those areas changed.

## Final Gate

Run the Docker final gate before relay cutover or deletion claims; otherwise
record it as not run.

## Must Not

- Do not include disabled or removed relays in any read or write plan.
- Do not let partial relay failure block reachable relays.
- Do not synthesize relay data, NIP-11 metadata, or NIP-65 suggestions; see
  [../no-fake-data.md](../no-fake-data.md).
- Do not auto-import relay suggestions or overwrite a disabled relay record.
- Do not treat missing reads as proof of absence.
- Do not leave relay jobs, waiters, or limiter queue entries without an owner
  and a cleanup path.

## Handoff

Name the reducer and host-adapter boundaries that changed and the relay proof
gaps that remain open in blocker row 2.
