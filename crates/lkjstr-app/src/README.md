# App Source

## Purpose

App source files compose pure domain and storage contracts into product runtime
reducers.

## Table of Contents

- `custom_request/`: pure Custom Request parsing, clamps, and mode selection.
- `feed/`: pure feed-window reduction and cursor derivation.
- `feed_scan/`: adaptive grouped scan planning and trace reducers.
- `lib.rs`: public app crate exports.
- `query/`: pure query-demand planning from product inputs to relay contracts.
- `startup_snapshots.rs`: startup filtering for durable tab snapshot rows.
- `workspace_defaults.rs`: workspace runtime defaults and recovery IDs.
- `workspace_runtime.rs`: workspace startup and tab snapshot staging.
