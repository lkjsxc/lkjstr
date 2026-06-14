# Web Tests

## Purpose

Browser-bound WASM tests prove exported functions call real Rust code.

## Table of Contents

- `accounts_active_selector_test.rs`: SQLite active selector migration and failure-status tests.
- `accounts_indexed_db_test.rs`: IndexedDB account and local-secret tests.
- `accounts_selector_test_support.rs`: shared Accounts active selector test helpers.
- `author_context_provider_test.rs`: Rust Author Context tab rendering from host-owned SQLite event rows.
- `author_context_tab_test.rs`: Rust Author Context tab rendering from injected feed view-model rows.
- `author_context_unavailable_tab_test.rs`: Rust Author Context browser rendering of explicit unavailable states.
- `custom_request_relay_test.rs`: Custom Request relay filter, match, and snapshot Node WASM proof.
- `global_feed_cleanup_test.rs`: Rust Global tab provider cleanup browser proof.
- `global_feed_provider_test.rs`: Rust Global tab rendering from selected-relay SQLite cache evidence.
- `global_feed_tab_test.rs`: Rust Global tab rendering from injected feed view-model rows.
- `followees_cleanup_test.rs`: Rust Followees selected-relay cleanup browser proof.
- `followees_provider_test.rs`: Rust Followees tab rendering from host-owned SQLite kind-3 rows.
- `followees_relay_provider_test.rs`: Rust Followees selected-relay kind-3 discovery proof.
- `followees_route_provider_test.rs`: Rust Followees stored route discovery proof.
- `followees_retry_test.rs`: Rust Followees selected-relay retry diagnostic browser proof.
- `home_feed_provider_test.rs`: Rust Home tab rendering from host-owned SQLite cache evidence.
- `home_feed_tab_test.rs`: Rust Home tab rendering from injected feed view-model rows.
- `notifications_feed_cleanup_test.rs`: Rust Notifications tab provider cleanup browser proof.
- `notifications_feed_coverage_test.rs`: Rust Notifications tab exact account coverage proof.
- `notifications_feed_older_command_test.rs`: Rust Notifications older footer command browser proof.
- `notifications_feed_provider_test.rs`: Rust Notifications tab rendering from host-owned SQLite notification and event rows.
- `notifications_feed_relay_test.rs`: Notifications relay window and retained older cursor Node WASM proof.
- `notifications_feed_scroll_older_test.rs`: Rust Notifications downward near-end older scroll browser proof.
- `notifications_feed_scroll_test.rs`: Rust Notifications tab scroll-owner and row-flow browser proof.
- `profile_feed_tab_test.rs`: Rust Profile tab rendering from injected feed view-model rows.
- `profile_copy_support/`: shared copy-action test helpers.
- `profile_feed_tab_support/`: shared Profile tab browser helpers.
- `profile_follow_host_support/`: shared Profile follow host test helpers.
- `support/`: shared browser test support modules.
- `user_timeline_cleanup_test.rs`: Rust User Timeline selected-relay cleanup browser proof.
- `user_timeline_provider_test.rs`: Rust User Timeline rendering from host-owned SQLite kind-3 and display rows.
- `user_timeline_relay_provider_test.rs`: Rust User Timeline selected-relay kind-3 discovery proof.
- `user_timeline_route_provider_test.rs`: Rust User Timeline stored route-group discovery and partial-failure proof.
- `user_timeline_retry_test.rs`: Rust User Timeline selected-relay retry/auth/rate-limit diagnostic proof.
- `user_timeline_timeout_test.rs`: Rust User Timeline selected-relay timeout diagnostic proof.
- `accounts_tab_test.rs`: Rust Accounts browser rendering and storage-state tests.
- `protocol_bridge_test.rs`: protocol bridge browser tests.
- `indexed_db_test.rs`: IndexedDB narrow export tests and SQLite startup recovery tests.
- `relay_sets_indexed_db_test.rs`: IndexedDB relay-set tests.
- `relay_host_socket_test.rs`: relay WebSocket host adapter lifecycle tests.
- `relay_host_effect_runner_test.rs`: relay effect mapping and callback owner tests.
- `relay_host_timer_test.rs`: relay timer host adapter cleanup tests.
- `relay_score_bridge_test.rs`: relay score WASM bridge tests.
- `retention_dispatch_failure_test.rs`: retention dispatch failure mapping tests.
- `relay_settings_tab_test.rs`: Rust Relay Settings rendering and storage-state tests.
- `search_feed_tab_test.rs`: Rust Search tab idle shell and provider-gap browser proof.
- `settings_tab_test.rs`: Rust Settings browser rendering and persistence tests.
- `sqlite_active_selector_store_test.rs`: SQLite active selector get, put, and delete tests.
- `sqlite_retention_store_test.rs`: SQLite retention delete dispatch batch tests.
- `sqlite_store_test.rs`: SQLite protected repository calls over the worker adapter.
- `sqlite_settings_store_test.rs`: SQLite settings replace-all repository tests.
- `sqlite_tab_test_support.rs`: shared static-worker URL helper for tab tests.
- `stats_tab_test.rs`: Rust Stats browser rendering tests with the wasm-pack static worker URL.
- `storage_worker_test.rs`: Rust SQLite storage-worker adapter tests.
- `tweet_draft_tab_test.rs`: Rust Tweet draft rendering and storage-state tests.
- `upload_settings_tab_test.rs`: Rust Upload Settings rendering and NIP-96 discovery tests.
