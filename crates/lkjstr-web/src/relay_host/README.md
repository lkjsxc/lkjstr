# Relay Host Source

## Purpose

This directory owns relay browser host adapters for Rust/WASM code.

## Table of Contents

- `mod.rs`: public relay host exports.
- `message.rs`: socket text parsing through the Rust protocol crate.
- `problem.rs`: typed relay host failure values.
- `socket.rs`: owned `web_sys::WebSocket` handle and callback lifecycle.
- `timer.rs`: owned one-shot browser timeout handle.

These files do not own relay policy. Reducers decide reconnect, queue replay,
snapshots, and diagnostics.
