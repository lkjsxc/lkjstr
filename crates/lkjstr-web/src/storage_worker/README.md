# Storage Worker Source

## Purpose

This directory contains the Rust browser host adapter for the SQLite storage
worker.

## Table of Contents

- `broker.rs`: Rust/WASM reflection bridge to the JavaScript app broker.
- `client.rs`: worker or broker client ownership, deadlines, cancellation.
- `client_lifecycle.rs`: shared close and response handling.
- `mod.rs`: public module exports and default worker path.
- `outcome.rs`: worker outcome mapping to storage outcomes.
- `owner_lease/`: Web Lock owner lease helpers.
- `runtime.rs`: worker construction, request ids, and response decoding.
- `runtime_events.rs`: browser callbacks, timeouts, cancel, close, and drop.
- `types.rs`: typed worker request and response envelopes.

## Contract

Product storage borrows the JavaScript app broker. Direct `web_sys::Worker`
construction remains only for lower-level worker adapter tests and explicit
classic/module constructors. Product code must use typed requests and storage
outcomes; it must not call raw JavaScript worker APIs.
