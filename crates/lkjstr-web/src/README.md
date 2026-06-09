# Web Source

## Purpose

Source files expose Rust application behavior to the browser through
`wasm-bindgen`.

## Table of Contents

- `accounts_active.rs`: migration-only old active account localStorage helper.
- `accounts_host.rs`: SQLite-backed Accounts command provider.
- `accounts_nip07_host.rs`: NIP-07 account lookup helper for Accounts.
- `accounts_reveal_host.rs`: local secret reveal helper for Accounts.
- `accounts_selector_host.rs`: SQLite active-account selector resolution helper.
- `accounts_selector_status.rs`: Accounts selector status text helpers.
- `accounts_selector_store.rs`: SQLite active-account selector worker helpers.
- `app_log_host.rs`: SQLite-backed lkjstr Log command provider.
- `feed_geometry/`: feed geometry, fragment, measurement, and anchor bridge.
- `follow_graph/`: target follow-list parser bridge.
- `host_providers.rs`: Rust UI host provider assembly.
- `host_status.rs`: shared host status and browser time helpers.
- `lib.rs`: public WASM exports.
- `indexed_db/`: browser IndexedDB host adapter for narrow exports and tests.
- `nip07_host.rs`: browser NIP-07 public-key adapter.
- `protocol_bridge.rs`: protocol bridge operations.
- `relay_score/`: serializable relay read score bridge.
- `scan_model/`: serializable scan density planning bridge.
- `relay_host/`: relay WebSocket and browser timeout host adapters.
- `relay_selection.rs`: local selected relay-set preference helper.
- `relay_settings_host.rs`: SQLite-backed Relay Settings command provider.
- `response.rs`: structured JavaScript response helpers.
- `settings_host.rs`: SQLite-backed Settings command provider.
- `sqlite_host_store.rs`: owned open, close, and scoped SQLite store helper.
- `sqlite_store/`: worker-backed SQLite repository calls.
- `storage_worker/`: Rust host adapter for the SQLite storage worker.
- `tweet_host.rs`: SQLite-backed Tweet draft command provider.
- `upload_discovery.rs`: browser `fetch` NIP-96 endpoint resolution.
- `upload_settings_host.rs`: SQLite-backed Upload Settings command provider.
- `workspace_host.rs`: SQLite-backed workspace startup and persistence helper.

`lib.rs` owns the WASM start hook. The start hook asks `host_providers.rs` to
load workspace startup state from the SQLite worker before mounting the Rust UI
shell.
