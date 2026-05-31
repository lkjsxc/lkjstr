# Relay Runtime

## Purpose

This file defines Rust relay ownership. Status: design-only.

## Owners

`lkjstr-relays` owns pure relay state machines. `lkjstr-web` owns browser
WebSocket and timer adapters.

## Pure Runtime

The pure runtime owns:

- connection state transitions.
- outbound send queue decisions.
- subscription aliases.
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
