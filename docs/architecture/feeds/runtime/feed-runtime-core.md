# Feed Runtime Core

## Purpose

Define the pure Rust app core that composes query planning, live lease
ownership, and feed-window reduction for future feed surfaces.

Status: Rust owns the browser-independent core for runtime identity,
live-demand attachment, live-demand release, visibility transitions, and
generation-guarded window evidence. The shipped feed surfaces still use
TypeScript runtime wiring.

## Ownership

| Concern            | Owner                                     |
| ------------------ | ----------------------------------------- |
| Runtime id         | app feed runtime                          |
| Demand owner       | normalized to runtime id                  |
| Wire lease sharing | global `lkjstr-relays::LiveLeaseState`    |
| Visible rows       | `FeedWindowState`                         |
| Browser effects    | returned as typed live-lease effects only |

## Rules

- Runtime owners are tab or tool-session ids, not wire dedupe keys.
- Live attach plans a `QueryDemandPlan`, attaches its Demand to live leases,
  stores the current fingerprint, and returns typed effects.
- Reattaching with the same owner and equivalent wire fingerprint updates
  demand state without creating another open effect.
- Releasing closes only when the final visible compatible owner detaches.
- Visibility changes suspend or resume through the shared live lease reducer.
- Release removes the runtime owner from active live demand while retaining the
  bounded feed window for reattach.
- Window evidence remains generation-guarded and effect-free.

## Source

- `crates/lkjstr-app/src/feed/runtime.rs`: pure runtime composition functions.
- `crates/lkjstr-app/src/feed/runtime_types.rs`: runtime core input and output
  records.
- `crates/lkjstr-app/tests/feed_runtime_test.rs`: composition tests.
- `crates/lkjstr-app/tests/feed_runtime_lifecycle_test.rs`: owner release and
  window-retention tests.
