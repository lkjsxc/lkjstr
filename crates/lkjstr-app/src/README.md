# App Source

## Purpose

App source files compose pure domain and storage contracts into product runtime
reducers.

## Table of Contents

- `custom_request/`: pure Custom Request parsing, clamps, and mode selection.
- `events/`: pure shared event display planning.
- `feed/`: pure feed-window reduction and cursor derivation.
- `feed_fragments/`: real visual row planning for oversized events.
- `feed_geometry/`: row height estimates, measured models, and anchors.
- `feed_lod/`: real-data feed level-of-detail tree.
- `feed_scan/`: adaptive grouped scan planning and trace reducers.
- `feed_wait/`: first-paint, empty-state, and late-merge reducers.
- `follow_graph/`: target NIP-02 follow graph reducers.
- `lib.rs`: public app crate exports.
- `orchestration/`: pure read, prefetch, hydration, and retention decisions.
- `public_chat/`: pure NIP-28 query plans and publish templates.
- `query/`: pure query-demand planning from product inputs to relay contracts.
- `user_timeline/`: pure public target timeline discovery planning.
- `startup_snapshots.rs`: startup filtering for durable tab snapshot rows.
- `workspace_defaults.rs`: workspace runtime defaults and recovery IDs.
- `workspace_runtime.rs`: workspace startup and tab snapshot staging.
