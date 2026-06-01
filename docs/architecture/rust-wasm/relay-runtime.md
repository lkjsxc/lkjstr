# Relay Runtime

## Purpose

This file defines Rust relay ownership. Status: partial.

## Owners

Implemented now: `lkjstr-relays` owns pure send queue, request scheduler,
subscription id, subscription alias, close tombstone state machines, and
request message-size budgeting for outbound `REQ` frames. It also owns the
first pure relay client lifecycle reducer for connect, open, send, error,
close, reconnect-timer, connect-deadline, owner-close, and typed relay-message
decisions.

`lkjstr-web` owns the first browser WebSocket and timer adapter foundation:
socket handles store event callbacks, detach listeners during close, map send
and open failures into typed host problems, and expose idempotent close. Timer
handles own one browser timeout and clear it on owner cleanup.

Not implemented yet: raw socket-frame parsing inside the client host path, full
request budgets, page read dedupe, progressive snapshots, diagnostics merge,
demand and lease planning, and product wiring from relay reducers to browser
adapters.

## Pure Runtime

The pure runtime owns:

- outbound send queue decisions.
- connection lifecycle decisions.
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
`256`. Request message-size budgeting uses the actual Rust protocol encoder for
`["REQ", subId, ...filters]`, applies the app hard cap `65536` bytes, and
honors a smaller relay `max_message_length` cap.

## Host Adapter

The WebSocket adapter owns `web_sys::WebSocket`, message extraction, error
events, open and close events, send failures, and cleanup. Callback closures are
stored in a handle and cleared on close.

The timer adapter owns reconnect timers, connect timeouts, read deadlines, and
idle eviction timers. Timers are cleared on owner cleanup.

Adapter handles do not decide relay correctness. They report browser facts to
the relay runtime and leave reconnect, queue replay, tombstone, snapshot, and
diagnostic policy to pure Rust state machines.

## Correctness Rules

- Disabled or removed relays are excluded until the user enables or restores
  them.
- Relay scoring never becomes a correctness filter.
- Global remains selected-relay based.
- Targeted reads may use bounded protocol-derived routes.
- Relay AUTH remains diagnostic-only.
- Partial relay failure stays diagnostic and does not block reachable relays.
