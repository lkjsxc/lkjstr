# Relay Cutover Area

## Purpose

This file narrows the implementation-ledger relay row. Status: partial; it
tracks what Rust must own before TypeScript relay product modules can be
removed.

## Ledger Row Covered

- [Relay runtime](../implementation-ledger.md).

## Contract

- Current product owner: TypeScript relay pool and subscription orchestration.
- Desired Rust owner: `lkjstr-relays` for reducers, budgets, leases, page-read
  keys, route trust, diagnostics, and progressive snapshots; `lkjstr-web` for
  WebSocket, timers, and NIP-11 fetch; `lkjstr-app` for product demand wiring.
- Required real behavior: open sockets, send frames, close subscriptions, close
  relays, schedule and cancel timers, fetch NIP-11 metadata, emit diagnostics,
  enforce budgets, dedupe page reads, and clean owner-scoped leases.
- Storage dependency: relay diagnostics, route evidence, relay metadata,
  optimizer rows, and page-read evidence use typed storage repositories.
- Relay dependency: selected read relays remain fallback routes; targeted reads
  may add bounded protocol routes; Global uses selected read relays only.
- Browser dependency: `web_sys::WebSocket`, browser timers, bounded fetch for
  NIP-11, host-event mapping, and idempotent cleanup handles.
- Tests required: `cargo test -p lkjstr-relays`, `cargo test -p lkjstr-web`,
  relay page scan tests, adaptive window tests, orchestration tests, and
  `pnpm rust-wasm:quiet`.
- Deletion target: `src/lib/relays/**` orchestration and pool modules only
  after shipped surfaces use Rust demand wiring and no-import proof exists.
- Current status: partial. Reducers, request budgets, page-read keys,
  progressive snapshots, route planning, scoring, and the host effect runner
  exist; product wiring to all shipped surfaces remains open.
- Next task: feed shared runtime demand into the Rust relay host runner without
  deleting TypeScript relay paths.

## Acceptance Checklist

- [x] Rust emits typed effect commands for sockets, frames, timers, NIP-11, and
      diagnostics.
- [x] Host events are typed and cannot update a closed or replaced owner.
- [ ] WebSocket, timer, fetch, and page-read handles close idempotently.
- [ ] Malformed ingress is bounded before expensive parsing.
- [ ] Disabled and removed relays stay excluded.
- [ ] Partial relay failure is diagnostic and never blocks reachable relays.
- [ ] Progressive snapshots include per-relay state, EOSE, timeout, auth
      required, malformed count, and clamped filters.
- [x] Parity and deletion ledgers state the actual status.
