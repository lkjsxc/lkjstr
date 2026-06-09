# lkjstr Relays

## Purpose

This crate owns pure relay runtime state machines.

## Table of Contents

- [src/](src/): relay state machine source.
- [tests/](tests/): relay state machine tests.

## Ownership Index

- Owned meaning: selected relay eligibility, disabled relay exclusion, budgets,
  leases, subscriptions, page-read keys, progressive snapshots, scoring, route
  trust, EOSE tracking, malformed ingress classification, and cleanup state.
- Forbidden meaning: browser WebSocket objects, DOM timers, fetch handles,
  storage statements, UI copy, and fake relay data.
- Effect boundary: emits host-effect commands and consumes host events;
  `lkjstr-web` owns sockets, timers, and NIP-11 fetch.
- Main tests: `cargo test -p lkjstr-relays`.
- Next cutover task: connect pure relay effects to `lkjstr-web` WebSocket and
  timer adapters for product reads.
