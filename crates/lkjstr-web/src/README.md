# Web Source

## Purpose

Source files expose Rust application behavior to the browser through
`wasm-bindgen`.

## Table of Contents

- `lib.rs`: public WASM exports.
- `indexed_db/`: browser IndexedDB host adapter.
- `protocol_bridge.rs`: protocol bridge operations.
- `response.rs`: structured JavaScript response helpers.

`lib.rs` also owns the WASM start hook that loads workspace startup state from
IndexedDB before mounting the Rust UI shell.
