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
- `author_context_cache.rs`: Author Context worker-cache event row composition.
- `author_context_host.rs`: SQLite-backed Author Context feed view-model provider.
- `browser_inventory/`: browser-owned storage rows for Rust Stats.
- `feed_geometry/`: feed geometry, fragment, measurement, and anchor bridge.
- `feed_geometry_models.rs`: shared SQLite model loading for feed row geometry.
- `follow_graph/`: target follow-list parser bridge.
- `followees_host.rs`: SQLite-backed Followees view-model provider.
- `followees_relay*.rs`: Followees selected and route follow-list read bridge and probes.
- `followees_routes.rs`: Followees stored author-route loader.
- `global_feed_cache.rs`: Global selected-relay cache evidence composition.
- `global_feed_geometry.rs`: Global feed durable geometry model loader.
- `global_feed_host.rs`: SQLite-backed Global feed view-model provider.
- `global_feed_host_commands.rs`: retained Global older-load host commands.
- `global_feed_relay*.rs`: Global selected-relay browser read bridge and cursor probes.
- `host_providers.rs`: Rust UI host provider assembly with conservative action-tab defaults.
- `home_feed_cache.rs`: Home feed cache evidence composition.
- `home_feed_geometry.rs`: Home feed durable geometry model loader.
- `home_feed_host.rs`: SQLite-backed Home feed view-model provider.
- `host_status.rs`: shared host status and browser time helpers.
- `lib.rs`: public WASM exports.
- `indexed_db/`: browser IndexedDB host adapter for narrow exports and tests.
- `nip07_host.rs`: browser NIP-07 public-key and signing adapter.
- `notifications_feed_cache.rs`: Notifications SQLite row and source-event cache evidence.
- `notifications_feed_geometry.rs`: Notifications feed durable geometry model loader.
- `notifications_feed_host.rs`: SQLite-backed Notifications feed view-model provider.
- `notifications_feed_host_*.rs`: Notifications host commands, diagnostics, and storage helpers.
- `notifications_feed_relay*.rs`: Notifications selected-relay read, retained state, and test probes.
- `mount_api.rs`: browser mount helpers including injected feed test seams.
- `profile_follow_event.rs`: Profile follow-list event construction and signing.
- `profile_follow_host.rs`: SQLite-backed Profile follow state and toggle provider.
- `profile_follow_publish.rs`: Profile follow relay publish adapter.
- `profile_feed_status.rs`: shared Profile feed diagnostic and storage status helpers.
- `profile_feed_geometry.rs`: Profile feed durable geometry model loader.
- `protocol_bridge.rs`: protocol bridge operations.
- `relay_read_handle.rs`: browser-local relay read cancellation slots for leased UI requests.
- `relay_score/`: serializable relay read score bridge.
- `scan_model/`: serializable scan density planning bridge.
- `search_feed_geometry.rs`: Search feed durable geometry model loader.
- `user_timeline_geometry.rs`: User Timeline feed durable geometry model loader.
- `relay_host/`: relay WebSocket and browser timeout host adapters.
- `relay_selection.rs`: local selected relay-set preference helper.
- `relay_settings_host.rs`: SQLite-backed Relay Settings command provider.
- `repair_adapter.rs`: repair health and worker outcome mapping helpers.
- `retention_dispatch.rs`: pure retention dispatch statement-id planning.
- `retention_routes.rs`: retention resource-kind to statement-id routing.
- `response.rs`: structured JavaScript response helpers.
- `settings_host.rs`: SQLite-backed Settings command provider.
- `sqlite_host_store.rs`: owned open, close, and scoped SQLite store helper.
- `sqlite_store/`: worker-backed SQLite repository calls.
- `storage_worker/`: Rust host adapter for the SQLite storage worker.
- `tweet_host.rs`: SQLite-backed Tweet draft command provider.
- `thread_feed_status.rs`: shared Thread feed diagnostic and storage status helpers.
- `thread_feed_geometry.rs`: Thread feed durable geometry model loader.
- `user_timeline_*.rs`: User Timeline cache, exact coverage, relay discovery,
  bounded Stats counters, and view-model provider.
- `upload_discovery.rs`: browser `fetch` NIP-96 endpoint resolution.
- `upload_settings_host.rs`: SQLite-backed Upload Settings command provider.
- `workspace_host.rs`: SQLite-backed workspace startup and persistence helper.

`lib.rs` owns the WASM start hook. The start hook asks `host_providers.rs` to
load workspace startup state from the SQLite worker before mounting the Rust UI
shell.
