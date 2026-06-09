# Web Tests

## Purpose

Browser-bound WASM tests prove exported functions call real Rust code.

## Table of Contents

- `accounts_active_selector_test.rs`: SQLite active selector migration and failure-status tests.
- `accounts_indexed_db_test.rs`: IndexedDB account and local-secret tests.
- `accounts_selector_test_support.rs`: shared Accounts active selector test helpers.
- `accounts_tab_test.rs`: Rust Accounts browser rendering and storage-state tests.
- `protocol_bridge_test.rs`: protocol bridge browser tests.
- `indexed_db_test.rs`: IndexedDB narrow export tests and SQLite startup recovery tests.
- `relay_sets_indexed_db_test.rs`: IndexedDB relay-set tests.
- `relay_host_socket_test.rs`: relay WebSocket host adapter lifecycle tests.
- `relay_host_timer_test.rs`: relay timer host adapter cleanup tests.
- `relay_score_bridge_test.rs`: relay score WASM bridge tests.
- `relay_settings_tab_test.rs`: Rust Relay Settings rendering and storage-state tests.
- `settings_tab_test.rs`: Rust Settings browser rendering and persistence tests.
- `sqlite_active_selector_store_test.rs`: SQLite active selector get, put, and delete tests.
- `sqlite_store_test.rs`: SQLite protected repository calls over the worker adapter.
- `sqlite_settings_store_test.rs`: SQLite settings replace-all repository tests.
- `sqlite_tab_test_support.rs`: shared static-worker URL helper for tab tests.
- `stats_tab_test.rs`: Rust Stats browser rendering tests.
- `storage_worker_test.rs`: Rust SQLite storage-worker adapter tests.
- `tweet_draft_tab_test.rs`: Rust Tweet draft rendering and storage-state tests.
- `upload_settings_tab_test.rs`: Rust Upload Settings rendering and NIP-96 discovery tests.
