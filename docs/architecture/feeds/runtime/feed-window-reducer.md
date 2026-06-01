# Feed Window Reducer

## Purpose

Define the browser-independent Rust reducer that turns cache and relay event
evidence into a bounded visible feed window.

Status: Rust owns a pure app reducer for event-id windows, cursor derivation,
generation guards, and terminal empty-state readiness. Shipped Home, Global,
Profile, Thread, Notifications, Search, Custom Request, and Author Context
runtimes still use TypeScript until each surface is wired through Rust.

## State

| Field              | Meaning                                             |
| ------------------ | --------------------------------------------------- |
| `generation`       | Runtime generation; stale snapshots are ignored     |
| `events_by_id`     | Canonical map of visible candidate events           |
| `sorted_ids`       | Newest-first ids after dedupe and cap enforcement   |
| `newest_cursor`    | Compound cursor for top visible row                 |
| `oldest_cursor`    | Compound cursor for bottom visible row              |
| `terminal`         | True only after terminal cache or relay evidence    |
| `has_older`        | Older paging remains possible                       |
| `has_newer`        | Newer paging remains possible after top pruning     |

## Rules

- Merge cache rows and relay rows through the same reducer path.
- Deduplicate by event id before sorting or slicing.
- Sort by descending `created_at`, then ascending event id.
- Enforce the window cap after dedupe and sort.
- Derive display cursors only from rows retained in `sorted_ids`.
- Ignore evidence whose generation does not match the current state.
- Never report an empty terminal state while relay evidence is still pending.
- Reset replaces map state and increments generation outside storage effects.

## Integration

The reducer consumes `ProgressiveEvent` values from `lkjstr-relays`. It emits no
network, storage, DOM, timer, or callback effects. Future feed runtimes combine
this reducer with query-demand plans, live leases, page reads, storage
repositories, and Leptos rendering.

## Source

- `crates/lkjstr-app/src/feed/`: pure feed-window reducer and types.
- `crates/lkjstr-app/tests/feed_window_test.rs`: reducer behavior tests.
