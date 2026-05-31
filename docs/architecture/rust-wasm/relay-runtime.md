# Relay Runtime

## Purpose

This file defines Rust relay ownership. Status: partial.

## Owners

Implemented now: `lkjstr-relays` owns pure send queue, request scheduler,
subscription id, subscription alias, and close tombstone state machines.

Not implemented yet: full relay client reducer, request budgets, page read
dedupe, progressive snapshots, diagnostics merge, demand and lease planning, and
browser WebSocket or timer adapters. `lkjstr-web` will own browser WebSocket and
timer adapters.

## Pure Runtime

The pure runtime owns:

- outbound send queue decisions.
- request scheduling.
- subscription ids and aliases.
- local close tombstones.
- connection state transitions.
- request budgets.
- request byte limits.
- page read dedupe.
- EOSE, CLOSED, OK, NOTICE, and AUTH handling.
- progressive relay snapshots.
- relay diagnostics.
- demand and lease planning.
- relay plus request-context scoring.

Pure code has deterministic inputs and outputs. It does not allocate browser
callbacks or mutate global state.

The implemented Rust state machines mirror current TypeScript queue limits:
send queue capacity `64`, pending request capacity `64`, subscription id length
cap `48`, close tombstone default TTL `10` seconds, and tombstone max size
`256`.

## Host Adapter

The WebSocket adapter owns `web_sys::WebSocket`, message extraction, error
events, open and close events, send failures, and cleanup. Callback closures are
stored in a handle and cleared on close.

The timer adapter owns reconnect timers, connect timeouts, read deadlines, and
idle eviction timers. Timers are cleared on owner cleanup.

## Correctness Rules

- Disabled or removed relays are excluded until the user enables or restores
  them.
- Relay scoring never becomes a correctness filter.
- Global remains selected-relay based.
- Targeted reads may use bounded protocol-derived routes.
- Relay AUTH remains diagnostic-only.
- Partial relay failure stays diagnostic and does not block reachable relays.
