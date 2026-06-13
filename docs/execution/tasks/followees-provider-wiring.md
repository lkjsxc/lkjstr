# Followees Provider Wiring

## Purpose

Replace the Rust Followees placeholder with real rows derived from NIP-02
follow-list entries without claiming Followees, follow-graph, or tab-surface
deletion proof.

## Status

Implemented enabling slice. TypeScript Followees and follow-graph modules remain
the shipped owner until remaining parity, no-import, and final verification proof
exist.

## Current Evidence

- `crates/lkjstr-app/src/follow_graph/**` summarizes real kind `3` follow-list
  events and deduplicates valid `p` tags.
- `crates/lkjstr-web/src/follow_graph/mod.rs` exposes the Rust follow-list
  summary bridge used by the shipped Svelte follow graph path.
- `crates/lkjstr-app/tests/followees_view_test.rs` proves Followees rows come
  from real deduped NIP-02 entries and do not claim absence before proof.
- `crates/lkjstr-ui/src/workspace/followees.rs` renders a real Followees body
  from `FolloweesView`.
- `crates/lkjstr-ui/tests/followees_provider_test.rs` proves provider request
  forwarding and release suppression.
- `crates/lkjstr-web/tests/profile_feed_tab_test.rs` proves Profile opens the
  converted Followees tab and renders an injected real kind `3` follow-list row.
- `crates/lkjstr-web/src/followees_host.rs` is the default browser provider for
  cached worker-owned SQLite kind `3` rows and starts selected-relay discovery
  on cache miss.
- `crates/lkjstr-web/tests/followees_provider_test.rs` proves the default
  provider path through Profile following count and real cached kind `3` data.
- `crates/lkjstr-web/src/followees_relay*.rs` starts a bounded selected-relay
  kind `3` read on cache miss, stores the relay event in worker SQLite, and
  rebuilds Followees from real cache rows.
- `crates/lkjstr-web/tests/followees_relay_provider_test.rs` proves selected
  relay filters/matching/store behavior and direct Followees tab discovery.
- `crates/lkjstr-web/tests/followees_cleanup_test.rs` proves selected-relay
  Followees reads close on tab cleanup and forced late relay events do not render.
- `crates/lkjstr-web/tests/followees_retry_test.rs` proves selected-relay
  no-event reads render retryable diagnostics and Retry starts a new read.
- `crates/lkjstr-web/src/followees_routes.rs` loads stored author routes and
  excludes disabled-only route relays.
- `crates/lkjstr-web/tests/followees_route_provider_test.rs` proves stored
  NIP-65, provenance, and target routes discover a real follow-list while a
  disabled stored route is not requested.

## Next Edit

Continue remaining Followees parity and no-import prerequisites. Do not start
deletion proof yet.

## Files To Read

- `docs/product/feeds/followees.md`
- `docs/architecture/rust-wasm/cutover/feed-runtime.md`
- `docs/architecture/rust-wasm/cutover/parity-ledger.md`
- `crates/lkjstr-ui/src/workspace/profile_open.rs`
- `crates/lkjstr-ui/src/workspace/tab_content.rs`
- `crates/lkjstr-web/tests/profile_feed_tab_test.rs`

## Files To Touch

- `crates/lkjstr-app/src/follow_graph/**`
- `crates/lkjstr-ui/src/workspace/followees*.rs`
- `crates/lkjstr-web/src/followees_host.rs`
- `crates/lkjstr-web/src/followees_routes.rs`
- `crates/lkjstr-web/tests/profile_feed_tab_test.rs`
- `crates/lkjstr-web/tests/followees_route_provider_test.rs`
- Rust/WASM cutover ledgers and `docs/current-state.md`

## Focused Gate

```sh
cargo test -p lkjstr-app -- follow
cargo test -p lkjstr-ui followees
cargo check -p lkjstr-web --target wasm32-unknown-unknown
wasm-pack test --headless --chrome crates/lkjstr-web --test followees_provider_test
wasm-pack test --headless --chrome crates/lkjstr-web --test followees_relay_provider_test
wasm-pack test --headless --chrome crates/lkjstr-web --test followees_route_provider_test
wasm-pack test --headless --chrome crates/lkjstr-web --test followees_cleanup_test
wasm-pack test --headless --chrome crates/lkjstr-web --test followees_retry_test
wasm-pack test --headless --chrome crates/lkjstr-web --test profile_feed_tab_test
pnpm rust-wasm:quiet
```

## Acceptance

- Followees tabs no longer fall through to the pending placeholder body.
- Rust Followees rows come from real NIP-02 follow-list entries.
- The leading in-flow row labels the viewed profile without raw placeholder
  success copy.
- Empty, loading, and error states are explicit and retryable where a provider
  exists.
- Cache miss starts selected-relay kind `3` discovery and updates from real
  relay events stored in worker SQLite.
- Stored NIP-65, provenance, and target author routes can discover kind `3`
  without selected relays.
- Disabled stored route relays are excluded from Followees discovery.
- Cleanup closes selected-relay reads and suppresses late relay completions.
- Selected-relay no-event reads complete to retryable diagnostics and retry
  starts a new bounded read without claiming absence.
- Profile opening proof reaches the real Followees body.
- TypeScript Followees and follow-graph paths remain until remaining parity,
  no-import, and final gates prove deletion readiness.

## Must Not

- Do not synthesize users, profiles, follow-list rows, or successful discovery.
- Do not treat missing follow-list data as absence.
- Do not delete `src/lib/follow-graph`, `src/lib/tabs/followees`, or tab glue.
