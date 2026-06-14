# App Tests

## Purpose

App tests prove browser-independent application composition behavior.

## Table of Contents

- `feed_action_event_rows_test.rs`: action-event row summaries in the shared feed view model.
- `feed_window_test.rs`: pure feed-window merge, cursor, and guard behavior.
- `feed_runtime_test.rs`: pure feed runtime query, live lease, and window composition.
- `feed_surface_input_test.rs`: Home and Global live query input builders.
- `feed_view_model_test.rs`: shared feed row ids, event rows, and state rows.
- `home_feed_test.rs`: Home feed view-model rows and live-query gating.
- `home_feed_relay_test.rs`: Home feed relay snapshot rows and footer state.
- `notifications_feed_relay_test.rs`: Notifications relay snapshot rows and footer state.
- `notifications_feed_paging_test.rs`: Notifications cursor, exhaustion, and older-scroll gating.
- `notifications_feed_test.rs`: Notifications feed view-model rows and account-targeted live query gating.
- `profile_feed_test.rs`: Profile feed view-model rows and authored-query gating.
- `query_demand_test.rs`: pure query-demand route and wire planning.
- `search_feed_test.rs`: Search feed idle state, NIP-50 demand, and partial coverage rows.
- `storage_maintenance_test.rs`: storage readiness, retention, and repair planning.
- `storage_maintenance_support/`: shared storage maintenance fixtures.
- `user_timeline_discovery_test.rs`: User Timeline discovery route states.
- `user_timeline_surface_input_test.rs`: User Timeline live query surface and routes.
- `workspace_runtime_test.rs`: workspace startup and tab snapshot staging.
