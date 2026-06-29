# Storage Worker Source

## Purpose

This directory contains the Rust browser host adapter for the SQLite storage
worker.

## Table of Contents

- `client.rs`: worker lifecycle, request ownership, deadlines, cancellation.
- `mod.rs`: public module exports and default worker path.
- `outcome.rs`: worker outcome mapping to storage outcomes.
- `owner_lease/`: Web Lock owner lease helpers.
- `runtime.rs`: worker construction, request ids, and response decoding.
- `runtime_events.rs`: browser callbacks, timeouts, cancel, close, and drop.
- `types.rs`: typed worker request and response envelopes.

## Contract

The adapter may call `web_sys::Worker` directly. Product code must use typed
requests and storage outcomes; it must not call raw JavaScript worker APIs.
