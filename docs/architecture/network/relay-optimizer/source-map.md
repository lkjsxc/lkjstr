# Relay Optimizer Source Map

## Purpose

This file maps the optimizer contract to the source paths an agent should edit.
Use it after reading [README.md](README.md) and before changing code.

## Rust Sources

| Concern | Source paths | Proof |
| --- | --- | --- |
| Relay read scores and fairness | `crates/lkjstr-relays/src/read_score/` | `cargo test -p lkjstr-relays -- read_score` |
| Route evidence trust | `crates/lkjstr-relays/src/route_evidence/` | `cargo test -p lkjstr-relays -- route_evidence` |
| Scan span planning and reduction | `crates/lkjstr-app/src/feed_scan/` | `cargo test -p lkjstr-app -- feed_scan` |
| Wait and late merge policy | `crates/lkjstr-app/src/feed_wait/` | `cargo test -p lkjstr-app -- feed_wait` |
| Optimizer storage rows | `crates/lkjstr-storage/` | `cargo test -p lkjstr-storage -- optimizer` |
| WASM DTO bridges | `crates/lkjstr-web/` | `pnpm rust-wasm:quiet` |

## TypeScript Host Sources

| Concern | Source paths | Proof |
| --- | --- | --- |
| Relay page scan execution | `src/lib/events/relay-page-scan*.ts` | relay page scan unit tests |
| Scan model bridge loader | `src/lib/feed-surface/scan-model-wasm.ts`, `scan-model-bridge.ts` | scan model bridge tests |
| Scan model DTOs and keys | `src/lib/feed-surface/scan-model-dto.ts`, `scan-model-keys.ts` | scan model repository tests |
| SQLite model rows | `src/lib/feed-surface/scan-model-repository.ts` | scan model repository tests |
| Stats and debug projection | `src/lib/feed-surface/scan-model-debug.ts`, `src/lib/tabs/stats/` | runtime counter and cache status tests |
| Relay score host glue | `src/lib/relays/`, `tests/unit/relays/relay-read-score.test.ts` | relay score tests |

## Product Surfaces

Adaptive scan wiring applies to Home, Global, Profile posts, Notifications, and
safe Custom Request event-list reads. Thread, Search, Author Context, metadata,
and exact reference reads keep exact semantics unless the product wiring ledger
is changed first.

## Edit Rule

Change the docs, Rust reducer, TypeScript host glue, repository tests, and Stats
projection together when a behavior crosses the browser boundary. Do not add a
second shipped owner for scan math without an explicit bridge-unavailable state.
