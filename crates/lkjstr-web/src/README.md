# Web Source

## Purpose

Source files expose Rust application behavior to the browser through
`wasm-bindgen`.

## Table of Contents

- `accounts_active.rs`: local-storage active account helper.
- `accounts_host.rs`: browser-backed Accounts command provider.
- `lib.rs`: public WASM exports.
- `indexed_db/`: browser IndexedDB host adapter.
- `nip07_host.rs`: browser NIP-07 public-key adapter.
- `protocol_bridge.rs`: protocol bridge operations.
- `relay_host/`: relay WebSocket and browser timeout host adapters.
- `relay_settings_host.rs`: browser-backed Relay Settings command provider.
- `response.rs`: structured JavaScript response helpers.
- `settings_host.rs`: browser-backed Settings command provider.
- `sqlite_store/`: worker-backed SQLite repository calls.
- `storage_worker/`: Rust host adapter for the SQLite storage worker.
- `tweet_host.rs`: browser-backed Tweet draft command provider.
- `upload_discovery.rs`: browser `fetch` NIP-96 endpoint resolution.
- `upload_settings_host.rs`: browser-backed Upload Settings command provider.

`lib.rs` also owns the WASM start hook that loads workspace startup state from
IndexedDB before mounting the Rust UI shell.
