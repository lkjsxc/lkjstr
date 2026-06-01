# Relay Client Source

## Purpose

This directory owns pure relay client lifecycle state.

## Table of Contents

- `effect.rs`: effect commands emitted by the reducer.
- `event.rs`: lifecycle events consumed by the reducer.
- `message.rs`: typed relay-message state transitions.
- `message_state.rs`: bounded relay-message evidence.
- `mod.rs`: public reducer module exports.
- `reducer.rs`: lifecycle transition function.
- `state.rs`: reducer state and accessors.
- `transition.rs`: shared transition helpers and reconnect timing.

Browser adapters execute effects. This directory does not allocate sockets,
timers, or callbacks.
