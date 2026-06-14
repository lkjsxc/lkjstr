# App Source

## Purpose

App source files compose pure domain and storage contracts into product runtime
reducers.

## Table of Contents

- `author_context_feed/`: Author Context shared feed view-model composition.
- `custom_request/`: pure Custom Request parsing, clamps, and mode selection.
- `custom_request_feed/`: Custom Request shared feed view-model composition.
- `events/`: pure shared event display planning.
- `feed/`: pure feed-window reduction and cursor derivation.
- `feed_fragments/`: real visual row planning for oversized events.
- `feed_geometry/`: row height estimates, measured models, and anchors.
- `feed_lod/`: real-data feed level-of-detail tree.
- `feed_scan/`: adaptive grouped scan planning and trace reducers.
- `feed_wait/`: first-paint, empty-state, and late-merge reducers.
- `follow_graph/`: target NIP-02 follow graph reducers.
- `global_feed/`: Global feed view-model and query composition.
- `home_feed/`: Home feed view-model and query composition.
- `lib.rs`: public app crate exports.
- `notifications_feed/`: Notifications feed view-model and query composition.
- `orchestration/`: pure read, prefetch, hydration, and retention decisions.
- `profile_feed/`: Profile feed view-model and query composition.
- `public_chat/`: pure NIP-28 query plans and publish templates.
- `query/`: pure query-demand planning from product inputs to relay contracts.
- `search_feed/`: Search feed view-model and result merge planning.
- `storage_maintenance.rs`: readiness-gated retention and repair planning.
- `thread_feed/`: Thread feed view-model and parent/reply planning.
- `user_timeline/`: public target timeline discovery planning and feed view.
- `startup_snapshots.rs`: startup filtering for durable tab snapshot rows.
- `workspace_defaults.rs`: workspace runtime defaults and recovery IDs.
- `workspace_runtime.rs`: workspace startup and tab snapshot staging.
