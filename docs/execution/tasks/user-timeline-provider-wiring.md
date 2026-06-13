# User Timeline Provider Wiring

## Purpose

Replace the Rust User Timeline placeholder with a real Rust body that can render
target-scoped feed rows from a real NIP-02 author set without claiming route
completion or deletion proof.

## Status

Implemented enabling slice. TypeScript User Timeline modules remain the shipped
owner until route diagnostics, coverage, no-import, and final verification proof
exist.

## Current Evidence

- `crates/lkjstr-app/src/user_timeline/**` plans explicit discovery states.
- `crates/lkjstr-app/src/follow_graph/**` builds target timeline author sets
  from real kind `3` follow-list events.
- `crates/lkjstr-app/src/feed/surface_inputs.rs` gives User Timeline a distinct
  query surface instead of reusing Home or Profile.
- `crates/lkjstr-ui/src/workspace/user_timeline*.rs` renders the Leptos body
  through an async provider with cleanup and late-completion suppression.
- `crates/lkjstr-web/tests/profile_feed_tab_test.rs` proves the Profile action
  reaches a real User Timeline row from an injected NIP-02 author set.
- `crates/lkjstr-web/src/user_timeline_host.rs` and
  `crates/lkjstr-web/src/user_timeline_cache.rs` are the default browser
  provider path for cached worker-owned SQLite kind `3` and display rows.
- `crates/lkjstr-web/tests/user_timeline_provider_test.rs` proves the default
  provider path through Profile action and real cached User Timeline data.
- `crates/lkjstr-web/src/user_timeline_relay*.rs` starts a bounded selected-relay
  kind `3` read on cache miss, stores the relay event in worker SQLite, and
  rebuilds the User Timeline from real cache rows.
- `crates/lkjstr-web/tests/user_timeline_relay_provider_test.rs` proves selected
  relay filters/matching/store behavior and browser route discovery from the
  fixed `lkjsxc` New Tab path.
- `crates/lkjstr-web/tests/user_timeline_retry_test.rs` proves selected-relay
  no-event, AUTH, and rate-limited reads render explicit diagnostics.
- `crates/lkjstr-web/tests/user_timeline_route_provider_test.rs` proves stored
  NIP-65, provenance, and target author routes can discover target kind `3`,
  while disabled stored route relays stay excluded and partial route failures
  stay diagnostic.
- `crates/lkjstr-web/tests/user_timeline_timeout_test.rs` proves all selected
  relays timing out renders retry diagnostics without claiming absence.
- `crates/lkjstr-web/tests/user_timeline_cleanup_test.rs` proves selected-relay
  cleanup closes the relay read and suppresses late events.
- Focused User Timeline tests, browser wasm profile-action tests, clippy,
  repo/doc/line checks, and `pnpm rust-wasm:quiet` pass for this slice.

## Next Edit

Continue coverage, no-import proof, and deletion-prerequisite work without
removing TypeScript/Svelte paths.

## Files To Read

- `docs/product/feeds/user-timeline.md`
- `docs/architecture/rust-wasm/cutover/feed-runtime.md`
- `docs/architecture/rust-wasm/cutover/parity-ledger.md`
- `crates/lkjstr-app/src/follow_graph/author_set.rs`
- `crates/lkjstr-app/src/user_timeline/discovery/mod.rs`
- `crates/lkjstr-ui/src/workspace/tab_content.rs`
- `crates/lkjstr-web/tests/profile_feed_tab_test.rs`
- `crates/lkjstr-web/tests/user_timeline_relay_provider_test.rs`

## Files To Touch

- `crates/lkjstr-app/src/user_timeline/**`
- `crates/lkjstr-app/src/feed/surface_inputs.rs`
- `crates/lkjstr-ui/src/workspace/user_timeline*.rs`
- `crates/lkjstr-web/src/user_timeline_*.rs`
- `crates/lkjstr-web/tests/profile_feed_tab_test.rs`
- `crates/lkjstr-web/tests/user_timeline_provider_test.rs`
- `crates/lkjstr-web/tests/user_timeline_cleanup_test.rs`
- `crates/lkjstr-web/tests/user_timeline_relay_provider_test.rs`
- Rust/WASM cutover ledgers and `docs/current-state.md`

## Focused Gate

```sh
cargo test -p lkjstr-app -- user_timeline
cargo test -p lkjstr-ui user_timeline
cargo check -p lkjstr-web --target wasm32-unknown-unknown
wasm-pack test --headless --chrome crates/lkjstr-web --test profile_feed_tab_test
wasm-pack test --headless --chrome crates/lkjstr-web --test user_timeline_provider_test
wasm-pack test --headless --chrome crates/lkjstr-web --test user_timeline_cleanup_test
wasm-pack test --headless --chrome crates/lkjstr-web --test user_timeline_relay_provider_test
wasm-pack test --headless --chrome crates/lkjstr-web --test user_timeline_route_provider_test
wasm-pack test --headless --chrome crates/lkjstr-web --test user_timeline_retry_test
wasm-pack test --headless --chrome crates/lkjstr-web --test user_timeline_timeout_test
pnpm rust-wasm:quiet
```

## Acceptance

- User Timeline tabs no longer fall through to the pending placeholder body.
- Rust User Timeline rows come from real feed events under a real NIP-02
  author-set proof, or explicit target-posts-only degraded mode.
- Loading, incomplete, failed, auth, offline, and rate-limited states stay
  explicit and never treat cache miss as absence.
- Cache miss starts selected-relay kind `3` discovery and updates from real
  relay events stored in worker SQLite.
- Stored NIP-65, provenance, and target author routes can discover kind `3`
  without selected relays.
- Disabled stored route relays are excluded from User Timeline discovery.
- Cleanup closes the selected-relay read and suppresses late events.
- Selected-relay no-event, AUTH, and rate-limited reads complete to explicit
  diagnostics without claiming follow-list absence.
- Partial route failures and all selected-relay timeouts complete to explicit
  diagnostics without blocking reachable routes or claiming absence.
- The Profile action proof reaches the real User Timeline body.
- TypeScript User Timeline paths remain until broader route discovery,
  no-import, and final gates prove deletion readiness.

## Must Not

- Do not synthesize posts, follow lists, profiles, route success, or cache
  coverage.
- Do not reuse Home or Profile query surfaces for User Timeline.
- Do not delete `src/lib/user-timeline` or Svelte tab glue.
