# Feed Runtime Cutover

## Purpose

This contract defines the shared Rust feed runtime that Home, Global, Profile,
Thread, Notifications, Search result lists, Author Context, and User Timeline
must use before their TypeScript feed runtimes are deleted.

## Current Evidence

- Rust feed reducers: `crates/lkjstr-app/src/feed/**`, `feed_wait/**`,
  `feed_geometry/**`, `feed_fragments/**`, `feed_lod/**`, and `feed_scan/**`.
- Rust relay snapshots: `crates/lkjstr-relays/src/page_read/**`.
- Rust storage rows: `crates/lkjstr-storage/src/events.rs` and
  `crates/lkjstr-storage/src/feed_cache.rs`.
- Current shipped feed runtime: `src/lib/timeline/**`, `src/lib/profile/**`,
  `src/lib/thread/**`, `src/lib/notifications/**`, and `src/lib/feed-surface/**`.
- Rust pure reducers exist. Product wiring, SQLite proof, Leptos feed rendering,
  and TypeScript deletion remain partial.

## Runtime State

The shared runtime state contains:

- semantic feed id and surface kind.
- owner id, active account, subject pubkey or event id, and selected relay mode.
- route plan and route group fingerprints.
- cache proof for each required relay, route group, filter shape, and interval.
- page-read demand and live subscription preference.
- progressive relay snapshots and partial failure diagnostics.
- event map, stable row ids, ordering cursors, `hasOlder`, and `hasNewer`.
- footer state, unavailable state, and retry commands.
- scroll anchor hints, width bucket, row geometry estimate, and reservation key.
- hydration priority queue with owner-scoped cancellation.

## Feed Row View Model

Rows use stable ids and real data only:

```text
event:<event-id>
profile:<pubkey>
notification:<event-id>:<kind>
unavailable:<reason>:<subject>
diagnostic:<scope>:<id>
footer:<feed-id>
```

A row view model includes renderer kind, event id or unavailable reason,
author identity state, timestamp, content fragments, media descriptors, custom
emoji, content warning state, repost or reference target state, action state,
height reservation, and diagnostics. Components must not parse Nostr events.

## Cache Proof

Cache-hit display is valid only when storage coverage proves all required
semantic keys, route groups, relay URLs, normalized filters, and bounded time
intervals. Missing, stale, compacted, dense, incomplete, auth-required, failed,
or disabled-relay evidence cannot prove absence. Missing cache rows trigger
relay planning or an explicit unavailable state, not an empty feed.

## Progressive Snapshot Consumption

The runtime merges snapshots by event id as relays answer. Fast relay rows can
render before slow relays finish. Slow or failed routes update diagnostics and
footer state without blocking reachable relays. A terminal empty state appears
only when every required route group has complete proof for the requested span.

## Route Group Completeness

Each read records route group key, relays attempted, relays excluded, relays
that reached EOSE, failed relays, auth-required relays, timeout state, cursor,
span, and cache proof expiry. EOSE from one route group never proves absence for
another group. Global is complete only for selected enabled read relays.

## Footer States

The footer is data, not a component inference. Required states are loading,
cache-hit, reading-relays, partial, auth-required, retryable failure,
configuration unavailable, terminal empty, terminal with rows, and older-load
ready. Footer rows must carry the command, disabled reason, or diagnostic id.

## Scroll And Geometry Ownership

`lkjstr-app` owns pure anchor capture, anchor reconciliation, row geometry
estimates, visual fragments, height reservation, dematerialization, and LOD tree
state. `lkjstr-web` may report DOM measurements. Durable row-height observation
persistence remains open and must use typed SQLite repositories when added.

## Unavailable-State Derivation

Unavailable state is explicit data. It records the subject, missing proof,
attempted relays, excluded relays, storage failures, route failures, signer or
account absence when relevant, and retry availability. Reference previews must
be backed by real events or compact unavailable rows.

## Must Not Clauses

- No fake data.
- No placeholder success.
- No direct browser database access from product code.
- No unbounded arrays.
- No hidden global state.
- No deletion before parity proof.
- No status claim without source/test evidence.
